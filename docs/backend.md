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

## 3. Pago: en el local

La aplicacion reserva; se paga al llegar. Sin pasarela de pago.

**Por que:** integrar cobros anade obligaciones fiscales y de datos que no
hacen falta para abrir. Se puede anadir despues sin rehacer las reservas.

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
| `js/identidad.js`          | **Se sustituye entero** por sesion real de Supabase        |
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

## Pendiente de decidir

- **Cancelaciones**: plazo y consecuencia. Hay que escribirlo antes de
  programarlo.
- **Ley 29733 (datos personales, Peru)**: se van a guardar nombres,
  contactos y habitos de asistencia. Necesita politica de privacidad y
  consentimiento. No se resuelve con codigo.
- **Aforo real y precios reales**: siguen siendo provisionales, igual que
  la planta de `planta.js`.
