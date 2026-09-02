-- Migracion 002: crea la tabla "incomes" para el registro de ingresos
-- Base de datos objetivo: control_de_gastos
-- Esta migracion es aditiva: no modifica la tabla "users" existente.

CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL,
    income_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acelera "GET /api/incomes" y el calculo del resumen, que siempre
-- filtran por el usuario autenticado.
CREATE INDEX IF NOT EXISTS incomes_user_id_idx ON incomes (user_id);

-- Nota: esta tabla se crea vacia a proposito. No existe seed de ingresos:
-- los registros solo se crean a traves de la API, asociados a un usuario
-- autenticado real.
