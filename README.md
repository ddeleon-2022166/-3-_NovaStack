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
de Google** (botón "Continuar con Google") junto al login tradicional,
sin modificar el diseño, el Dashboard, Ingresos, ni la expiración actual
del JWT.

Todavía no se incluyen el registro público de usuarios, la recuperación de
contraseña, los roles avanzados, refresh tokens, ni los módulos de Gastos
o Cuentas a pagar (por eso esas dos tarjetas del Dashboard se muestran
fijas en `Q0.00`); eso queda para entregas posteriores.

---

## 1. Resumen de la arquitectura

- **Backend**: construido con Node.js, Express y TypeScript, siguiendo una
  arquitectura modular por capas (rutas → controladores → servicios →
  modelos). PostgreSQL es la base de datos real que se consulta en cada
  login y en cada operación de ingresos. Las contraseñas se cifran con
  `bcryptjs`, la autenticación se maneja con `jsonwebtoken`, las variables
  sensibles viven en un `.env` gestionado con `dotenv`, y CORS está
  restringido al origen del frontend. El módulo `incomes` sigue la misma
  estructura que `auth` (modelo, servicio, controlador, rutas,
  validadores) y reutiliza el mismo `authMiddleware` para exigir un JWT
  válido en cada endpoint. El login con Google reutiliza exactamente esa
  misma arquitectura: `POST /api/auth/google` verifica el ID token con la
  librería oficial `google-auth-library`, y emite el mismo JWT interno que
  el login tradicional (los endpoints privados nunca aceptan el token de
  Google como sustituto).
- **Frontend**: hecho en Angular con componentes standalone y TypeScript.
  Usa formularios reactivos, `HttpClient`, un interceptor funcional que
  agrega el JWT a cada petición que lo necesita, y un guard funcional que
  protege el layout autenticado. Ese layout (barra lateral + barra
  superior) vive en un componente compartido que envuelve tanto al
  Dashboard (`/dashboard`) como a Ingresos (`/ingresos`), evitando
  duplicar la barra de navegación entre secciones. Ingresos ya está
  conectado a la API real: el formulario registra ingresos en PostgreSQL,
  la tabla y el total se vuelven a consultar automáticamente después de
  cada registro, y el Dashboard consulta ese mismo total cada vez que se
  entra a la pantalla. El diseño visual se inspira en la paleta del logo:
  fondo oscuro azulado, turquesa, dorado/naranja y azul. La pantalla de
  login conserva exactamente ese diseño; el botón "Continuar con Google"
  (Google Identity Services) se agregó debajo del formulario existente,
  separado por un divisor sutil, sin alterar colores, tipografía ni
  distribución.
- **Comunicación**: Angular corre en `http://localhost:4200` y consume la
  API REST de Express en `http://localhost:3000/api`.
- **Nota de arquitectura**: ya se dejó preparado el lugar donde vivirán los
  futuros módulos `expenses` y `bills` (administración de gastos y cuentas
  a pagar) dentro de `src/modules/` del backend, siguiendo el mismo patrón
  que `incomes`, pero todavía no se implementan en esta entrega.

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

3. Ejecute las migraciones (crean las tablas `users` e `incomes`, y
   agregan los campos de Google a `users`; el script corre todos los
   archivos `.sql` de `database/migrations/` en orden, así que un solo
   comando alcanza para las tres):

   ```bash
   pnpm --dir backend run db:migrate
   ```

   La migración `003_add_google_auth.sql` es aditiva y no destructiva:
   agrega las columnas `auth_provider`, `google_sub` y `profile_picture`
   a `users`, permite que `password_hash` sea `NULL` (para cuentas creadas
   solo con Google), y agrega un índice único parcial sobre `google_sub`.
   No modifica ni borra nada de las migraciones `001` y `002`, y es segura
   de volver a ejecutar.

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

La tarjeta `INGRESOS` del Dashboard consulta `GET /api/incomes/summary`
cada vez que se entra a `/dashboard` (incluyendo al volver desde
Ingresos), así que refleja el total real sin necesidad de volver a
iniciar sesión. `GASTOS` y `CUENTAS A PAGAR` se muestran fijas en `Q0.00`
porque esos módulos todavía no existen; `PRESUPUESTO RESTANTE` se calcula
como `ingresos - gastos - cuentas por pagar` (por ahora, igual al total de
ingresos, ya que los otros dos términos son cero).

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
