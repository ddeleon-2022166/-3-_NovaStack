-- Migracion 007: crea la tabla "objectives" para el modulo de Objetivos.
-- Base de datos objetivo: control_de_gastos
-- Es aditiva y no destructiva: no modifica ninguna tabla ni migracion
-- anterior (users, incomes, expenses, periods, user_sessions siguen intactas).
--
-- Diseno: a diferencia de "periods" (que calcula sus totales por rango de
-- fechas contra incomes/expenses), "objectives" SI tiene una relacion real
-- en base de datos (FK) hacia "periods", porque la maqueta pide mostrar el
-- "Periodo relacionado" de cada objetivo como un dato propio del registro,
-- no como algo derivable por fecha.
--
-- El estado ("status") no se recibe del formulario: se recalcula siempre
-- en el backend a partir de current_amount / target_amount (ver
-- objective.service.ts), para que nunca quede desincronizado del progreso
-- real. Por eso aqui solo se restringe a los tres valores posibles.

CREATE TABLE IF NOT EXISTS objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES periods (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('Ahorro', 'Educacion', 'Compra', 'Inversion', 'Otros')),
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    deadline DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'no_iniciado'
        CHECK (status IN ('no_iniciado', 'en_progreso', 'cumplido')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acelera "GET /api/objectives", que siempre filtra por el usuario autenticado.
CREATE INDEX IF NOT EXISTS objectives_user_id_idx ON objectives (user_id);

-- Acelera el filtro por periodo, tanto en el backend como al validar que
-- el period_id enviado pertenezca al usuario autenticado.
CREATE INDEX IF NOT EXISTS objectives_period_id_idx ON objectives (period_id);

-- Nota: esta tabla se crea vacia a proposito. No existe seed de
-- objetivos: los registros solo se crean, editan, eliminan o actualizan a
-- traves de la API, asociados siempre a un usuario autenticado real y a
-- un periodo real ya existente.
