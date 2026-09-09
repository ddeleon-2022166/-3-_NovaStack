-- Migracion 003: agrega soporte de inicio de sesion con Google a la tabla "users"
-- Base de datos objetivo: control_de_gastos
-- Esta migracion es aditiva y no destructiva: no elimina ni renombra columnas,
-- no toca las migraciones anteriores, y es segura de volver a ejecutar
-- (todas las sentencias usan IF NOT EXISTS / verificaciones equivalentes).

-- Nuevas columnas necesarias para identificar el proveedor de autenticacion
-- y, en el caso de Google, el identificador estable de la cuenta ("sub")
-- y la foto de perfil publica.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255),
    ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);

-- Los usuarios creados unicamente a traves de Google no tienen contrasena
-- propia en NovaStack, por lo que "password_hash" debe aceptar NULL.
-- Los usuarios tradicionales (con contrasena) no se ven afectados.
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

-- "google_sub" debe ser unico cuando existe, pero varios usuarios
-- tradicionales sin cuenta de Google vinculada deben poder convivir con
-- el valor NULL (por eso el indice unico es parcial: solo aplica cuando
-- google_sub no es NULL).
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx
    ON users (google_sub)
    WHERE google_sub IS NOT NULL;

-- Nota: el correo (email) ya era UNIQUE desde la migracion 001, por lo que
-- sigue siendo la clave que evita duplicar un usuario que ya existia con
-- login tradicional cuando ese mismo correo inicia sesion con Google.
