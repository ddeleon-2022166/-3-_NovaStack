# Control de Gastos — Entrega 1: Autenticación (Login con JWT + Google)

Esta entrega del proyecto académico "Control de Gastos" cubre el flujo de
inicio de sesión y dos secciones protegidas: un usuario ya registrado (el
cliente de la aplicación) ingresa su correo y su contraseña, el backend
valida esas credenciales contra PostgreSQL, devuelve un JWT si todo es
correcto, y el frontend lo lleva al **Dashboard** (`/dashboard`), protegido
por el mismo JWT. Desde la barra lateral del Dashboard también se puede
entrar a la sección **Ingresos** (`/ingresos`), igualmente protegida por
sesión, donde ahora sí se pueden registrar ingresos reales: quedan
guardados en PostgreSQL, asociados al usuario autenticado, y tanto la
tabla de Ingresos como la tarjeta "INGRESOS" del Dashboard muestran el
total calculado directamente desde la base de datos.

Esta entrega agrega, además, el inicio de sesión con **cuentas personales
de Google** (botón "Continuar con Google") junto al login tradicional, y
la sección **Egresos** (`/egresos`), con el mismo nivel de persistencia
real que Ingresos: registro, consulta, edición y eliminación, todo
guardado en PostgreSQL y asociado al usuario autenticado. Nada de esto
modifica el diseño ya aprobado del Dashboard ni de Ingresos, ni la
expiración actual del JWT.

Todavía no se incluyen el registro público de usuarios, la recuperación de
contraseña, los roles avanzados, refresh tokens, ni el módulo de Cuentas a
pagar (por eso esa tarjeta del Dashboard se muestra fija en `Q0.00`); eso
queda para entregas posteriores.

---

## 1. Resumen de la arquitectura

- **Backend**: construido con Node.js, Express y TypeScript, siguiendo una
  arquitectura modular por capas (rutas → controladores → servicios →
  modelos). PostgreSQL es la base de datos real que se consulta en cada
  login y en cada operación de ingresos o egresos. Las contraseñas se
  cifran con `bcryptjs`, la autenticación se maneja con `jsonwebtoken`, las
  variables sensibles viven en un `.env` gestionado con `dotenv`, y CORS
  está restringido al origen del frontend. El módulo `expenses` sigue
  exactamente la misma estructura que `incomes` (modelo, servicio,
  controlador, rutas, validadores) y reutiliza el mismo `authMiddleware`
  para exigir un JWT y una sesión válidos en cada endpoint; a diferencia de
  `incomes`, además permite editar y eliminar, siempre verificando que el
  registro pertenezca al usuario autenticado. El login con Google reutiliza
  exactamente esa misma arquitectura: `POST /api/auth/google` verifica el
  ID token con la librería oficial `google-auth-library`, y emite el mismo
  JWT interno que el login tradicional (los endpoints privados nunca
  aceptan el token de Google como sustituto).
- **Frontend**: hecho en Angular con componentes standalone y TypeScript.
  Usa formularios reactivos, `HttpClient`, un interceptor funcional que
  agrega el JWT a cada petición que lo necesita, y un guard funcional que
  protege el layout autenticado. Ese layout (barra lateral + barra
  superior) vive en un componente compartido que envuelve al Dashboard
  (`/dashboard`), Ingresos (`/ingresos`) y ahora también Egresos
  (`/egresos`), evitando duplicar la barra de navegación entre secciones.
  La opción "Egresos" de la barra lateral (antes "Informe") usa el mismo
  componente compartido para resaltarse como activa solo en su propia
  ruta. Ingresos y Egresos están conectados a la API real: cada formulario
  registra su tipo de movimiento en PostgreSQL, la tabla y el total se
  vuelven a consultar automáticamente después de cada cambio (crear,
  editar o eliminar), y el Dashboard consulta ambos totales cada vez que
  se entra a la pantalla. El diseño visual se inspira en la paleta del
  logo: fondo oscuro azulado, turquesa, dorado/naranja y azul. La pantalla
  de login conserva exactamente ese diseño; el botón "Continuar con
  Google" (Google Identity Services) se agregó debajo del formulario
  existente, separado por un divisor sutil, sin alterar colores,
  tipografía ni distribución.
- **Comunicación**: Angular corre en `http://localhost:4200` y consume la
  API REST de Express en `http://localhost:3000/api`.
- **Nota de arquitectura**: ya se dejó preparado el lugar donde vivirá el
  futuro módulo `bills` (cuentas a pagar) dentro de `src/modules/` del
  backend, siguiendo el mismo patrón que `incomes` y `expenses`, pero
  todavía no se implementa en esta entrega.

---

## 2. Configuración de Google Cloud (login con Google)

Para que el botón "Continuar con Google" funcione, se necesita un OAuth
Client ID de Google. Pasos:

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea
   un proyecto nuevo (o usa uno existente).
2. En **APIs y servicios → Pantalla de consentimiento de OAuth**,
   configúrala como tipo **Externo** (o Interno si usas Google Workspace),
   completa el nombre de la app y el correo de soporte, y guarda.
3. En **APIs y servicios → Credenciales**, crea un **ID de cliente de
   OAuth 2.0** de tipo **Aplicación web**.
4. En **Orígenes de JavaScript autorizados**, agrega:

   ```
   http://localhost:4200
   ```

5. Guarda y copia el **Client ID** generado (no el Client Secret; el
   flujo de esta entrega no lo necesita en ningún lugar).
6. Coloca ese Client ID en `backend/.env` (variable `GOOGLE_CLIENT_ID`) y
   también en `frontend/src/environments/environment.development.ts` y
   `environment.ts` (propiedad `googleClientId`).
7. Si más adelante despliegas el frontend en otro dominio, recuerda
   agregar también ese origen a la lista de orígenes autorizados en el
   paso 4.

Si `GOOGLE_CLIENT_ID` no está configurado, el login tradicional sigue
funcionando con normalidad; el botón de Google simplemente no aparece.

---

## 3. Requisitos previos

Antes de empezar, asegúrese de tener instalado:

- Node.js 18 o superior, junto con pnpm.
- PostgreSQL 14 o superior corriendo localmente.
- Visual Studio Code.
- Git (no es indispensable para esta entrega, pero conviene tenerlo listo
  para el resto del curso).

---

## 4. Comandos para preparar el proyecto

Desde la carpeta raíz `control-de-gastos`, puede instalar todo de dos
formas:

```bash
# Opción A: usando los atajos del package.json raíz
pnpm run install:all

# Opción B: instalando cada parte por separado
cd backend && pnpm install
cd ../frontend && pnpm install
```

---

## 5. Configuración de PostgreSQL y variables de entorno

1. Cree la base de datos (por ejemplo, desde `psql` o cualquier cliente
   gráfico que prefiera):

   ```sql
   CREATE DATABASE control_de_gastos;
   ```

2. Dentro de `backend/`, copie el archivo de ejemplo y complételo con sus
   propias credenciales de PostgreSQL:

   ```bash
   cd backend
   cp .env.example .env
   ```

   Abra `.env` y ajuste al menos `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`
   (para este último, cualquier cadena larga y aleatoria funciona bien).

3. Ejecute las migraciones (crean las tablas `users`, `incomes`,
   `user_sessions` y `expenses`, y agregan los campos de Google a
   `users`; el script corre todos los archivos `.sql` de
   `database/migrations/` en orden, así que un solo comando alcanza para
   las cinco):

   ```bash
   pnpm --dir backend run db:migrate
   ```

   La migración `005_create_expenses_table.sql` es la nueva de esta
   entrega: crea `expenses` con la misma forma que `incomes` (incluida la
   restricción `CHECK (amount > 0)`), sin tocar ninguna migración
   anterior. La migración `003_add_google_auth.sql` es aditiva y no
   destructiva: agrega las columnas `auth_provider`, `google_sub` y
   `profile_picture` a `users`, permite que `password_hash` sea `NULL`
   (para cuentas creadas solo con Google), y agrega un índice único
   parcial sobre `google_sub`. Ninguna de las cinco migraciones modifica
   ni borra nada de las anteriores, y todas son seguras de volver a
   ejecutar.

4. Ejecute el seed para crear el usuario inicial de prueba:

   ```bash
   pnpm --dir backend run db:seed
   ```

5. Si quiere confirmar que el usuario se creó correctamente, puede
   consultarlo así:

   ```sql
   SELECT id, name, email, created_at FROM users;
   ```

   La tabla `incomes` se crea vacía a propósito (no tiene seed): los
   registros solo se crean a través de la aplicación, una vez que inicia
   sesión y usa el formulario de la sección Ingresos.

---

## 6. Ejecutar el backend

```bash
cd backend
pnpm run dev
```

En la consola debería ver algo como esto:

```
Conexion a PostgreSQL exitosa (base de datos: control_de_gastos)
Servidor backend escuchando en http://localhost:3000
CORS habilitado para: http://localhost:4200
```

Si en algún momento quiere probar la versión compilada en lugar del modo
desarrollo, puede hacerlo con:

```bash
pnpm run build
pnpm start
```

---

Para levantar el frontend:

```bash
cd frontend
pnpm start
```

Luego abra `http://localhost:4200` en su navegador. Con el backend
corriendo en otra terminal, ya debería ver la pantalla de login lista para
usarse. Al iniciar sesión con las credenciales de la sección 8, la
aplicación le redirige automáticamente a `/dashboard`. Desde ahí, la opción
"Ingresos" de la barra lateral lleva a `/ingresos` (también protegida por
sesión), donde puede registrar ingresos reales con el formulario: quedan
guardados en PostgreSQL, y tanto la tabla como el total ("Ingresos
Totales") se actualizan automáticamente después de guardar. Si todavía no
ha registrado ninguno, verá el total en `Q0.00` y el mensaje "No hay
ingresos registrados" en la tabla, en vez de datos inventados.

---

## 8. Credenciales del usuario de prueba

```
Correo:     cliente@controldegastos.com
Contraseña: Cliente2026*
```
Estas credenciales se crean automáticamente con el script de seed
(`pnpm run db:seed`) y quedan guardadas cifradas con `bcryptjs` en
PostgreSQL. La contraseña en texto plano solo aparece aquí, en esta
documentación, para que pueda probar el login sin complicaciones.

---

## 9. Endpoints de Ingresos

Todos requieren un JWT válido (el mismo `Authorization: Bearer <token>`
que ya usa `/api/auth/me`), y solo devuelven u operan sobre los ingresos
del usuario autenticado; el `user_id` nunca se recibe desde el frontend,
siempre se toma del token verificado.

- **`POST /api/incomes`** — registra un nuevo ingreso. Recibe
  `description`, `amount`, `category` (una de `Sueldos`, `Freelance`,
  `Inversiones`, `Otros`) e `incomeDate` (formato `AAAA-MM-DD`). Rechaza
  montos menores o iguales a cero, y cualquier campo faltante.
- **`GET /api/incomes`** — devuelve los ingresos del usuario autenticado,
  del más reciente al más antiguo.
- **`GET /api/incomes/summary`** — devuelve `{ "total": "0.00" }` (o el
  total real), calculado con `SUM()` directamente en PostgreSQL, nunca
  acumulado a mano en el backend o el frontend.

### Cómo se actualiza el Dashboard

La tarjeta `INGRESOS` del Dashboard consulta `GET /api/incomes/summary`, y
la tarjeta `GASTOS` consulta `GET /api/expenses/summary` (ver sección 12),
cada vez que se entra a `/dashboard` (incluyendo al volver desde Ingresos
o Egresos), así que ambas reflejan el total real sin necesidad de volver
a iniciar sesión. `CUENTAS A PAGAR` se muestra fija en `Q0.00` porque ese
módulo todavía no existe; `PRESUPUESTO RESTANTE` se calcula como
`ingresos - gastos - cuentas por pagar`, siempre a partir de los dos
totales reales, nunca como un valor guardado manualmente.

---

## 10. Login con Google — endpoint y prueba local

- **`POST /api/auth/google`** — recibe `{ "idToken": "..." }` (el ID token
  que entrega Google Identity Services en el navegador), lo verifica con
  `google-auth-library` (firma, audiencia, emisor, expiración y correo
  verificado), y responde exactamente en el mismo formato que
  `POST /api/auth/login`:

  ```json
  {
    "message": "Inicio de sesion exitoso.",
    "token": "JWT_INTERNO",
    "user": { "id": "...", "name": "...", "email": "...", "profilePicture": "..." }
  }
  ```

- Si el correo de Google ya existía como usuario tradicional, la cuenta se
  vincula (se agrega `google_sub`) sin tocar su contraseña: ese usuario
  puede seguir iniciando sesión con correo y contraseña, o con Google,
  indistintamente.
- Si el correo no existía, se crea un usuario nuevo con `auth_provider =
  'google'` y `password_hash = NULL`.

### Qué probar localmente (no se pudo ejecutar en este entorno)

Este entorno de trabajo no tiene salida a redes externas ni una instancia
de PostgreSQL disponible, así que la integración quedó preparada pero
**no se ejecutó de extremo a extremo**. Antes de dar por completada la
entrega, prueba localmente:

1. Que el botón "Continuar con Google" aparezca en `/login` una vez
   configurado `GOOGLE_CLIENT_ID` (backend) y `googleClientId` (frontend).
2. Un login con una cuenta de Google nueva (correo que no existe todavía
   en `users`): debe crear el usuario y redirigir a `/dashboard`.
3. Un login con una cuenta de Google cuyo correo ya existe como usuario
   tradicional: debe vincular la cuenta (no duplicarla) y seguir
   permitiendo el login con contraseña.
4. Volver a iniciar sesión con la misma cuenta de Google una segunda vez:
   no debe crear un usuario duplicado.
5. Enviar un `idToken` inválido o manipulado a `POST /api/auth/google`
   directamente (por ejemplo, con `curl` o Postman): debe responder
   `401` con un mensaje genérico, sin filtrar detalles internos.
6. Confirmar que el login tradicional, el Dashboard, Ingresos, el
   interceptor, el guard, el cierre de sesión y la expiración de sesión
   actual siguen funcionando exactamente igual que antes.

---

## 11. Vencimiento de sesión por inactividad

Además del vencimiento fijo original del JWT, ahora cada sesión se
controla en PostgreSQL (tabla `user_sessions`, migración `004`) y el
backend es quien decide si sigue siendo válida — el temporizador de
Angular es solo una capa de aviso, no la protección real.

- **Inactividad (15 minutos):** si no hay actividad real del usuario
  (clic, teclado, táctil o navegación — el movimiento del mouse y las
  peticiones automáticas no cuentan), la sesión vence. Cada actividad
  reinicia el contador desde cero.
- **Duración máxima absoluta (8 horas):** una sesión nunca dura más de
  este tiempo, aunque haya actividad constante. Se calcula una única vez
  al iniciar sesión (`absolute_expires_at`) y nunca se extiende.
- **`POST /api/auth/session/activity`:** ruta protegida que Angular llama
  ante actividad real (máximo una vez por minuto). Renueva
  `last_activity_at` y devuelve un JWT nuevo con el mismo `sid`, sin
  tocar el límite absoluto.
- **`POST /api/auth/logout`:** revoca la sesión en PostgreSQL. Una sesión
  revocada, o ya vencida, no puede reutilizarse aunque el JWT firmado
  todavía "parezca" vigente.
- Al vencer la sesión (por inactividad, por límite absoluto, o por un
  `401` con `code: "SESSION_EXPIRED"` detectado por el interceptor), se
  muestra el mismo `SessionExpiredModalComponent` de siempre, se limpia
  la sesión local, y se sincroniza el cierre entre pestañas mediante
  `BroadcastChannel`. El comportamiento es idéntico para cuentas
  autenticadas con contraseña o con Google.

### Variables de entorno (`backend/.env.example`)

```env
SESSION_IDLE_TIMEOUT_MINUTES=15
SESSION_ABSOLUTE_TIMEOUT_HOURS=8
JWT_EXPIRES_IN=15m
```

Para probar el vencimiento por inactividad en segundos en vez de
minutos, cambia temporalmente (solo en local, nunca en `.env` real de
producción):

```env
SESSION_IDLE_TIMEOUT_MINUTES=1
JWT_EXPIRES_IN=1m
```

### Migración

```bash
pnpm --dir backend run db:migrate
```

Aplica `004_create_user_sessions.sql` (aditiva, no destructiva: no
modifica `users` ni `incomes`).

### Compilar

```bash
pnpm --dir backend run build
pnpm --dir frontend run build
```

---

## 12. Egresos: endpoints, edición y eliminación

La sección Egresos (`/egresos`) sigue el mismo patrón que Ingresos, con
dos diferencias: en la barra lateral reemplaza a la antigua opción
"Informe" (usa el mismo ícono grande de portapapeles, ya no un enlace
vacío), y su formulario también permite **editar** y **eliminar**
registros existentes, no solo crearlos.

### Migración

```bash
pnpm --dir backend run db:migrate
```

Aplica `005_create_expenses_table.sql` (aditiva, no destructiva: no
modifica `users`, `incomes`, `user_sessions` ni las migraciones
anteriores). Crea `expenses` con las mismas garantías que `incomes`:
`user_id` con clave foránea hacia `users`, `amount NUMERIC(12,2)` con
`CHECK (amount > 0)`, y `description`, `category`, `expense_date`
obligatorios. La tabla se crea vacía; no existe seed de egresos.

### Endpoints

Todos requieren un JWT y una sesión válidos (el mismo mecanismo que ya
protege Ingresos), y solo devuelven u operan sobre los egresos del
usuario autenticado — el `user_id` nunca se recibe desde el frontend, y
las operaciones de edición/eliminación verifican en la misma consulta SQL
que el registro pertenezca a quien hace la solicitud:

- **`POST /api/expenses`** — registra un nuevo egreso. Recibe
  `description`, `amount`, `category` (una de `Comida`, `Servicios`,
  `Viajes`, `Entretenimiento`, `Salud`, `Otros`) y `expenseDate` (formato
  `AAAA-MM-DD`). Rechaza montos menores o iguales a cero.
- **`GET /api/expenses`** — devuelve los egresos del usuario autenticado,
  del más reciente al más antiguo.
- **`GET /api/expenses/summary`** — devuelve `{ "total": "0.00" }` (o el
  total real), calculado con `SUM()` directamente en PostgreSQL.
- **`PUT /api/expenses/:id`** — edita un egreso existente (mismos campos
  que al crear). Responde `404` si el registro no existe o pertenece a
  otro usuario.
- **`DELETE /api/expenses/:id`** — elimina un egreso existente. Responde
  `404` en el mismo caso anterior.

### Editar y eliminar desde la interfaz

Cada fila de la tabla incluye los íconos de lápiz (editar) y papelera
(eliminar) de la maqueta, ahora funcionales:

- **Editar** carga los datos del egreso en el formulario de la izquierda,
  cambia el botón a "Guardar cambios" y muestra un botón "Cancelar
  edición" para volver al modo de creación sin guardar nada.
- **Eliminar** pide confirmación (mediante el diálogo nativo del
  navegador) antes de borrar el registro.

En ambos casos, al completarse la operación, la tabla y el total
("Egresos Totales") se vuelven a consultar automáticamente desde
PostgreSQL.

---

## 13. Corrección de errores (esta entrega)

1. **Botón "Continuar con Google" intermitente**: el script de Google
   Identity Services se carga con `async defer` en `index.html`, así que
   en una red lenta podía no estar listo todavía cuando Angular
   inicializaba el login (por eso a veces solo aparecía después de
   recargar la página). Ahora `LoginComponent` reintenta cada 250 ms
   durante 10 segundos antes de darse por vencido, en vez de comprobarlo
   una sola vez.
2. **Vencimiento de sesión poco confiable en redes lentas**: el JWT tenía
   la misma duración que el límite de inactividad (15 min), así que un
   solo fallo de red al renovarlo (`POST /api/auth/session/activity`)
   podía cerrar la sesión de golpe aunque el usuario siguiera activo. Se
   agregaron reintentos cortos a esa llamada, se redujo el intervalo
   entre notificaciones de actividad (30 s en vez de 60 s), y el JWT
   ahora dura 20 minutos (5 de margen) — el límite real de inactividad lo
   sigue aplicando el backend contra PostgreSQL, no el JWT.
3. **Pantallas que no cabían sin hacer zoom**: `DashboardShellComponent`
   tenía `overflow: hidden` en el área de contenido, así que cualquier
   pantalla más alta que el espacio disponible (Ingresos o Egresos con
   varios registros, por ejemplo) quedaba recortada en vez de mostrar una
   barra de desplazamiento. Ahora esa área permite scroll vertical
   (`overflow-y: auto`), corregido en el layout compartido, por lo que
   aplica a todas las secciones (Dashboard, Ingresos, Egresos).
4. **Editar y eliminar en Ingresos**: existían únicamente para Egresos.
   Se agregaron `PUT /api/incomes/:id` y `DELETE /api/incomes/:id` en el
   backend (mismo patrón que egresos, verificando siempre que el registro
   pertenezca al usuario autenticado) y se conectó el formulario y los
   íconos de la tabla en el frontend.
5. **Alineación entre el formulario y la tabla**: en Ingresos y Egresos,
   ambas columnas ahora se estiran a la misma altura (antes cada una
   tomaba solo el alto de su propio contenido), para que la sección se
   vea equilibrada bajo su título.
6. **Egresos mayores al saldo disponible**: el backend ahora calcula, en
   cada creación o edición de un egreso, el saldo disponible
   (`ingresos - egresos, sin contar el que se esta editando`) y rechaza
   el egreso con un mensaje claro si el monto lo supera:
   *"No cuenta con fondos suficientes para registrar este egreso. Su
   presupuesto disponible es de Q___."* El Dashboard, además, nunca
   muestra `PRESUPUESTO RESTANTE` en negativo (queda en `Q0.00` como
   salvaguarda de presentación, aunque en condiciones normales el
   backend ya no debería permitir llegar a ese caso).

### Limitación conocida (no corregida en esta entrega)

La comprobación de saldo disponible no usa una transacción con bloqueo de
fila en PostgreSQL: si el mismo usuario enviara dos solicitudes de egreso
casi simultáneas (por ejemplo, desde dos pestañas a la vez), en teoría
ambas podrían leer el mismo saldo disponible antes de que la primera
termine de guardarse, permitiendo superar el límite por una carrera de
datos. El botón "Guardar" ya se deshabilita mientras se envía una
solicitud, lo que cubre el caso común (doble clic), pero una solución
completa requeriría una transacción con `SELECT ... FOR UPDATE` alrededor
de la comprobación y la inserción. Queda documentado como mejora
pendiente.

---

## 14. Historial: consulta unificada de ingresos y egresos

`/historial` combina, en una sola tabla de solo lectura, los registros de
Ingresos y de Egresos, con filtros, tarjetas de resumen y paginación. Se
accede desde la opción de la barra lateral que ya administra los egresos
(ver nota importante más abajo); **no se agregó ninguna opción nueva a la
barra lateral**, esa opción ya existía y simplemente no tenía una vista
propia todavía.

### Cómo se combinan los datos

No se creó ningún endpoint nuevo en el backend. `HistoryComponent` llama,
en paralelo, a `GET /api/incomes` y `GET /api/expenses` (los mismos que ya
usan las secciones Ingresos y Egresos), normaliza ambas respuestas a una
forma común (`Movement`, definida en
`frontend/src/app/features/history/history.models.ts`) marcando cada una
como `"ingreso"` o `"egreso"`, las combina y las ordena de la más reciente
a la más antigua. Los filtros, las tarjetas de resumen y la paginación se
calculan en el frontend sobre esa lista ya combinada — es una vista de
solo lectura, no se agregó edición ni eliminación desde aquí.

### Nota sobre el nombre de la sección en la barra lateral

Esta funcionalidad se pidió describiendo la barra lateral como
"Informe, Historial, Ingresos", con Egresos administrado dentro de
"Informe". En el proyecto real, esa misma sección (administración de
egresos) ya se llama **"Egresos"** en la barra lateral, no "Informe" —
así quedó en una entrega anterior. Siguiendo la instrucción explícita de
no modificar la barra lateral bajo ninguna circunstancia, se dejó el
nombre "Egresos" exactamente como está; no se renombró a "Informe". La
barra lateral sigue mostrando exactamente tres opciones, en el mismo
orden, con los mismos íconos: **Egresos, Historial, Ingresos**. Solo se
conectó "Historial" a una ruta real (antes era un botón sin destino), sin
tocar texto, ícono, posición ni comportamiento de ninguna de las tres.

### Filtros disponibles

- **Periodo**: "Todos", "Último mes" (últimos 30 días), "Últimos 7 días" y
  "Este mes" (mes calendario actual). No corresponde a una entidad de
  "periodos" real en la base de datos (ese módulo no existe todavía): son
  rangos de fecha calculados en el frontend.
- **Tipo de movimiento**: Todos, Ingreso, Egreso.
- **Categoría**: se llena dinámicamente a partir de las categorías que
  realmente aparecen en los movimientos del usuario (no una lista fija).
- **Fecha desde / Fecha hasta**: si "desde" es posterior a "hasta", se
  muestra un aviso y no se aplican los filtros hasta corregirlo.
- **Buscar**: coincide contra la descripción y la categoría.

Todos se combinan entre sí, y solo se aplican al presionar
"Aplicar filtros"; "Limpiar filtros" los restablece todos.

### La columna "Método / Origen"

Ni los ingresos ni los egresos guardan actualmente un dato de método de
pago u origen del movimiento (no existe esa columna en `incomes` ni en
`expenses`). Para no inventar valores, esa columna muestra
"No especificado" en todos los casos, tanto en la tabla como en el
detalle. Si en el futuro se agrega ese dato al modelo, esta columna ya
está lista para mostrarlo.

### Instrucciones para probar la vista

1. Inicie sesión y registre al menos un par de ingresos (en `/ingresos`)
   y un par de egresos (en `/egresos`), con fechas y categorías distintas.
2. Entre a `/historial` desde la barra lateral: debería ver los cuatro
   movimientos combinados, ordenados del más reciente al más antiguo, con
   las tarjetas de resumen ya calculadas.
3. Pruebe cada filtro por separado y luego combinados (por ejemplo, Tipo
   "Egreso" + una categoría + un rango de fechas), y confirme que la
   tabla, las tarjetas y el conteo de movimientos cambian de acuerdo con
   el resultado.
4. Presione "Limpiar filtros" y confirme que vuelve a ver todos los
   movimientos.
5. Haga clic en el ícono de la columna "Acciones" de cualquier fila:
   debería abrirse el detalle del movimiento con sus datos reales.
6. Si tiene más de 10 movimientos en total, pruebe la paginación
   (primera, anterior, siguiente, última página).

### Limitación conocida

La fecha de un ingreso o egreso se guarda como una fecha simple
(`AAAA-MM-DD`, sin hora), así que la columna "Fecha" del Historial
muestra únicamente la fecha, sin hora — mostrar una hora inventada habría
sido un dato falso. Si en el futuro se agrega hora real a los
movimientos, esta vista está lista para mostrarla también.
