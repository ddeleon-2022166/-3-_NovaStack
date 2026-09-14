-- Migracion 005: crea la tabla "expenses" para el registro de egresos.
-- Base de datos objetivo: control_de_gastos
-- Es aditiva y no destructiva: no modifica ninguna tabla ni migracion
-- anterior (users, incomes, user_sessions siguen intactas).

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL,
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acelera "GET /api/expenses" y el calculo del resumen, que siempre
-- filtran por el usuario autenticado.
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses (user_id);

-- Nota: esta tabla se crea vacia a proposito. No existe seed de egresos:
-- los registros solo se crean, editan o eliminan a traves de la API,
-- asociados siempre a un usuario autenticado real.
