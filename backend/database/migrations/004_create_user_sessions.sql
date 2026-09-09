-- Migracion 004: crea la tabla "user_sessions" para el control de
-- vencimiento de sesion por inactividad y por duracion absoluta.
-- Base de datos objetivo: control_de_gastos
--
-- Esta migracion es aditiva y no destructiva:
-- - No modifica ni elimina ninguna tabla ni columna existente
--   ("users", "incomes").
-- - No borra ningun dato existente.
-- - Es segura de volver a ejecutar (usa IF NOT EXISTS en todas partes).

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ
);

-- Acelera la busqueda de todas las sesiones de un usuario (por ejemplo,
-- para una futura opcion de "cerrar sesion en todos los dispositivos").
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions (user_id);

-- Acelera la comprobacion de sesiones activas (no revocadas), que ocurre
-- en cada peticion protegida por el middleware de autenticacion.
CREATE INDEX IF NOT EXISTS user_sessions_active_idx
    ON user_sessions (id)
    WHERE is_revoked = FALSE;
