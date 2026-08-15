# Control de Gastos — Entrega 1: Autenticación (Login con JWT)

Esta es la primera entrega del proyecto académico "Control de Gastos", y se
centra exclusivamente en el flujo de inicio de sesión: un usuario ya
registrado (el cliente de la aplicación) ingresa su correo y su contraseña,
el backend valida esas credenciales contra PostgreSQL, devuelve un JWT si
todo es correcto, y el frontend lo lleva a una vista protegida donde ve el
mensaje:

> Bienvenido. Has iniciado sesión correctamente.

Todavía no se incluyen el registro público de usuarios, la recuperación de
contraseña, el login con proveedores externos, los roles avanzados ni el
módulo de gastos; eso queda para entregas posteriores.

---

## 1. Resumen de la arquitectura

- **Backend**: construido con Node.js, Express y TypeScript, siguiendo una
  arquitectura modular por capas (rutas → controladores → servicios →
  modelos). PostgreSQL es la base de datos real que se consulta en cada
  login. Las contraseñas se cifran con `bcryptjs`, la autenticación se
  maneja con `jsonwebtoken`, las variables sensibles viven en un `.env`
  gestionado con `dotenv`, y CORS está restringido al origen del frontend.
- **Frontend**: hecho en Angular con componentes standalone y TypeScript.
  Usa formularios reactivos, `HttpClient`, un interceptor funcional que
  agrega el JWT a cada petición que lo necesita, y un guard funcional que
  protege la ruta de bienvenida. El diseño visual se inspira en la paleta
  del logo: fondo oscuro azulado, turquesa, dorado/naranja y azul.
- **Comunicación**: Angular corre en `http://localhost:4200` y consume la
  API REST de Express en `http://localhost:3000/api`.
- **Nota de arquitectura**: ya se dejó preparado el lugar donde vivirá el
  futuro módulo `expenses` (administración de gastos) dentro de
  `src/modules/` del backend, pero en esta entrega no se implementa
  todavía.

---

## 3. Requisitos previos

Antes de empezar, asegúrate de tener instalado:

- Node.js 18 o superior, junto con npm.
- PostgreSQL 14 o superior corriendo localmente.
- Visual Studio Code.
- Git (no es indispensable para esta entrega, pero conviene tenerlo listo
  para el resto del curso).

---

## 4. Comandos para preparar el proyecto

Desde la carpeta raíz `control-de-gastos`, puedes instalar todo de dos
formas:

```bash
# Opción A: usando los atajos del package.json raíz
npm run install:all

# Opción B: instalando cada parte por separado
cd backend && npm install
cd ../frontend && npm install
```

---

## 5. Configuración de PostgreSQL y variables de entorno

1. Crea la base de datos (por ejemplo, desde `psql` o cualquier cliente
   gráfico que prefieras):

   ```sql
   CREATE DATABASE control_de_gastos;
   ```

2. Dentro de `backend/`, copia el archivo de ejemplo y complétalo con tus
   propias credenciales de PostgreSQL:

   ```bash
   cd backend
   cp .env.example .env
   ```

   Abre `.env` y ajusta al menos `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`
   (para este último, cualquier cadena larga y aleatoria funciona bien).

3. Ejecuta la migración para crear la tabla `users`:

   ```bash
   npm run db:migrate --prefix backend
   ```

4. Ejecuta el seed para crear el usuario inicial de prueba:

   ```bash
   npm run db:seed --prefix backend
   ```

   Puedes correr el seed varias veces sin miedo: si el usuario ya existe,
   el script lo detecta y no crea duplicados.

5. Si quieres confirmar que el usuario se creó correctamente, puedes
   consultarlo así:

   ```sql
   SELECT id, name, email, created_at FROM users;
   ```

---

## 6. Ejecutar el backend

```bash
cd backend
npm run dev
```

En la consola deberías ver algo como esto:

```
Conexion a PostgreSQL exitosa (base de datos: control_de_gastos)
Servidor backend escuchando en http://localhost:3000
CORS habilitado para: http://localhost:4200
```

Si en algún momento quieres probar la versión compilada en lugar del modo
desarrollo, puedes hacerlo con:

```bash
npm run build
npm start
```

---

Para levantar el frontend:

```bash
cd frontend
npm start
```

Luego abre `http://localhost:4200` en tu navegador. Con el backend
corriendo en otra terminal, ya deberías ver la pantalla de login lista para
usarse.

---

## 8. Credenciales del usuario de prueba

```
Correo:     cliente@controldegastos.com
Contraseña: Cliente2026*
```

Estas credenciales se crean automáticamente con el script de seed
(`npm run db:seed`) y quedan guardadas cifradas con `bcryptjs` en
PostgreSQL. La contraseña en texto plano solo aparece aquí, en esta
documentación, para que puedas probar el login sin complicaciones.

---
