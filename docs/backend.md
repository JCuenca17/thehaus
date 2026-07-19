# Backend, cuentas y reservas de varios dias

Decisiones cerradas antes de escribir codigo. Si algo se demuestra
equivocado se cambia, pero conviene que quede por que se eligio.

Estado: **decidido, sin implementar**. Lo desplegado hoy sigue siendo una
demostracion sin backend.

---

## 1. Plataforma: Supabase

Postgres, autenticacion y permisos por fila en un solo servicio. El front
sigue siendo estatico en Vercel y sin build step, que es lo que hace que
este proyecto sea facil de mantener.

**Por que no funciones serverless + auth propia:** implicaria escribir
manejo de contrasenas, sesiones y recuperacion de cuenta. Ese codigo es
facil de escribir mal y dificil de auditar, y el fallo se paga con las
cuentas de los clientes. No es sitio para artesania.

## 2. Modelo de precio: descuento por tramos

Se cobra por reserva, mas barato cuantos mas dias:

| Dias reservados | Descuento |
| --------------- | --------- |
| 1-4             | —         |
| 5-9             | 10 %      |
| 10-19           | 15 %      |
| 20+             | 25 %      |

(Los tramos son de partida y viven en base de datos, no en el codigo.)

**Por que no abonos mensuales todavia:** un abono no es una reserva, es
una suscripcion, y arrastra cobro recurrente, renovaciones y bajas. El
descuento por tramos encaja con el modelo actual —una fila por dia— y se
puede abrir ya. Los abonos se anaden despues, cuando haya cobro.

## 3. Pago: en linea, al reservar

La reserva se confirma cuando el pago se aprueba. **La reserva se escribe
despues del pago, no antes**: la disponibilidad se revalida al escribir,
asi que si alguien coge el sitio durante el pago, el choque se detecta ahi
y —con cobro real— se devuelve.

Hoy es una simulacion (`js/pagos-simulados.js`) con tres caminos:
aprobado, rechazado y caducado. **No hay campos de tarjeta, ni siquiera
simulados**: un formulario que pida el numero en una URL publica ensena a
la gente a escribirlo sin nada que lo cifre ni lo cobre, y una tarjeta
sirve en cualquier otra parte. El resultado lo elige quien prueba con tres
botones; todo lo que rodea a esa eleccion es el flujo real.

**Cambio respecto a la decision inicial:** se penso abrir cobrando en el
local para no arrastrar obligaciones fiscales y de datos. Se pasa a pago en
linea porque el front ya ensaya ese flujo y montarlo despues obligaria a
rehacer la confirmacion de la reserva. Cuando entre pasarela real, quien la
integre reemplaza el archivo simulado por uno que devuelva el mismo
resultado; **la integracion de la pasarela no se hace en el cliente**.

## 4. Cuenta obligatoria

Para entrar a `/app` hay que tener cuenta. WhatsApp se queda en la landing
para quien solo quiere visitar el local, que es otra conversacion.

---

## Esquema

```sql
-- Supabase Auth gestiona la tabla de usuarios; esto es el perfil
create table perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null,
  contacto    text not null,
  creado      timestamptz not null default now()
);

-- Una fila por dia reservado, agrupadas por reserva.
-- Mantener la fila por dia es deliberado: la deteccion de choques y el
-- estado del plano funcionan por (unidad, fecha, franja), y con rangos
-- guardados como intervalos habria que reescribir esa logica entera.
create table reservas (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null,              -- une los dias de una misma reserva
  usuario_id  uuid not null references perfiles(id) on delete cascade,
  unidad_id   text not null,              -- id de planta.js: "ws-01", "of-2"…
  zona        text not null,
  fecha       date not null,
  franja      text not null check (franja in ('manana','tarde','completo')),
  importe     numeric(8,2) not null,      -- ya con el descuento aplicado
  creada      timestamptz not null default now()
);

-- Nadie puede reservar lo ya reservado. Esta restriccion es la unica
-- garantia real: la comprobacion en el cliente es comodidad, no seguridad.
create unique index reservas_sin_choque
  on reservas (unidad_id, fecha, franja);

create table tarifas (
  zona        text primary key,
  manana      numeric(8,2) not null,
  tarde       numeric(8,2) not null,
  completo    numeric(8,2) not null
);

create table tramos_descuento (
  dias_desde  int primary key,
  descuento   numeric(4,3) not null       -- 0.10 = 10 %
);
```

### El choque de "dia completo"

El indice unico no cubre que `completo` choca con `manana` y `tarde`. Hay
que resolverlo en una transaccion del servidor —o con una restriccion de
exclusion sobre rangos horarios— **nunca solo en el cliente**.

### Permisos por fila

- `perfiles`: cada quien ve y edita el suyo.
- `reservas`: cada quien ve y cancela las suyas; **lectura publica solo de
  `unidad_id`, `fecha` y `franja`** mediante una vista, para pintar el
  plano sin exponer quien reservo que. Esto ultimo es importante: la
  ocupacion es publica, el nombre de quien ocupa no.

---

## Que cambia en el codigo actual

| Modulo                     | Cambio                                                    |
| -------------------------- | --------------------------------------------------------- |
| `js/sesion-simulada.js`    | **Se borra entero**; lo reemplaza la sesion de Supabase     |
| `js/pagos-simulados.js`    | **Se borra entero**; lo reemplaza la pasarela real          |
| `js/reservas.js`           | Por dentro pasa a la API; se mantiene la firma publica     |
| `js/tarifas.js`            | Los precios vienen de la base de datos                     |
| `js/planta.js`             | Sin cambios                                                |
| `js/escena3d.js`           | Anade el estado `parcial`                                  |
| `app/app.js`               | Puerta de sesion, seleccion de varios dias, ficha nueva    |

## Flujo de varios dias

1. Se eligen los dias (seleccion multiple, ventana de 4 semanas).
2. Se elige la franja, la misma para todo el rango.
3. El plano colorea segun disponibilidad **de todo el rango**: verde solo
   si esta libre todos los dias.
4. Si falla algun dia, la unidad sale como `parcial` y la ficha dice cual
   falla, con dos acciones explicitas: reservar solo los dias libres, o
   ver que unidades estan libres todos.

Nunca se reserva un subconjunto sin decirlo: el usuario tiene que poder
reconocer lo que acaba de reservar.

---

## Reservas anteriores a las cuentas

Se **descartan** al aparecer la puerta de sesion, subiendo la version de la
clave de almacenamiento y avisando una vez.

No se atribuyen a la primera cuenta que se cree: eso haria que alguien
abriera la aplicacion y heredase reservas que no hizo. Inventar propiedad
sobre unos datos es peor que perder datos de demostracion.

## Cancelaciones

Se cancela un dia suelto o la reserva entera. **Plazo libre hasta las 18:00
del dia anterior**; el espacio vuelve al fondo comun en el acto.

Pasado el plazo tambien se puede cancelar, y es deliberado: como se paga en
el local, una cancelacion tardia no cuesta una devolucion, cuesta un puesto
vacio. Un puesto liberado a las 8 de la manana todavia lo puede ocupar
alguien; uno bloqueado por orgullo del sistema no lo ocupa nadie. Lo unico
que no se cancela es un dia ya empezado, porque ya esta consumido.

**Sin penalizacion en la primera version.** No hay cobro que retener, y una
multa que no se puede ejecutar es decorado. Lo que si se guarda es la marca
de cancelacion tardia: si las ausencias llegan a ser un problema real, la
decision se tomara con datos y no a ojo.

```sql
alter table reservas
  add column cancelada_en timestamptz,
  add column cancelacion_tardia boolean not null default false;
```

Las filas no se borran: una reserva cancelada que desaparece no se puede
contar despues. La vista publica de ocupacion filtra `cancelada_en is null`.

### El descuento se recalcula

Quien reserva 10 dias entra en el tramo del 15 % y cancela 4, se queda con
6 dias: **pasa al tramo del 10 % y el importe de los dias que siguen en pie
se rehace**. Si no, o cobras 6 dias a precio de 10 —que es cobrar de mas— o
abres la puerta a reservar 20 dias, cancelar 15 y quedarte el 25 %.

La aplicacion lo dice **antes** de confirmar la cancelacion, con el importe
nuevo a la vista. Nadie deberia enterarse de que subio el precio al llegar
al mostrador. Como todavia no se ha cobrado nada, rehacer el importe es
solo aritmetica.

## Pendiente de decidir

- **Ley 29733 (datos personales, Peru)**: se van a guardar nombres,
  contactos y habitos de asistencia. Necesita politica de privacidad y
  consentimiento. No se resuelve con codigo.
- **Aforo real y precios reales**: siguen siendo provisionales, igual que
  la planta de `planta.js`.
