-- Migracion 001: crea la tabla "users" para el modulo de autenticacion
-- Base de datos objetivo: control_de_gastos

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice adicional explicito sobre el correo para acelerar el login
-- (UNIQUE ya crea un indice, esta linea queda documentada por claridad academica)
-- CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
