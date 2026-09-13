-- Migracion 006: crea la tabla "periods" para el modulo de Periodos.
-- Base de datos objetivo: control_de_gastos
-- Es aditiva y no destructiva: no modifica ninguna tabla ni migracion
-- anterior (users, incomes, expenses, user_sessions siguen intactas).
--
-- Diseno: "periods" no tiene una relacion en base de datos (FK) hacia
-- "incomes" ni "expenses". Los totales de ingresos, egresos y balance de
-- cada periodo se calculan en tiempo de consulta, comparando el rango
-- de fechas del periodo (start_date / end_date) contra income_date y
-- expense_date. Se eligio este enfoque, mas simple, porque no requiere
-- agregar columnas a tablas ya existentes ni migrar datos historicos.

CREATE TABLE IF NOT EXISTS periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'planificado'
        CHECK (status IN ('activo', 'cerrado', 'planificado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT periods_end_after_start CHECK (end_date >= start_date)
);

-- Acelera "GET /api/periods", que siempre filtra por el usuario
-- autenticado y ordena por fecha.
CREATE INDEX IF NOT EXISTS periods_user_id_idx ON periods (user_id);

-- Garantiza, directamente en PostgreSQL, que un usuario no pueda tener
-- dos periodos "activo" al mismo tiempo (indice unico parcial: solo
-- aplica a las filas con status = 'activo').
CREATE UNIQUE INDEX IF NOT EXISTS periods_single_active_idx
    ON periods (user_id)
    WHERE status = 'activo';

-- Nota: esta tabla se crea vacia a proposito. No existe seed de
-- periodos: los registros solo se crean, editan, eliminan o activan a
-- traves de la API, asociados siempre a un usuario autenticado real.
