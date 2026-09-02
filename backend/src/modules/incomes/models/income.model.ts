import { pool } from "../../../config/database";

// Representa una fila completa de la tabla "incomes".
// PostgreSQL devuelve las columnas NUMERIC como texto (para no perder
// precision decimal en JavaScript) y las columnas DATE como texto en
// formato "AAAA-MM-DD"; por eso ambos campos se tipan como string aqui.
export interface IncomeRecord {
  id: string;
  user_id: string;
  description: string;
  amount: string;
  category: string;
  income_date: string;
  created_at: Date;
  updated_at: Date;
}

export interface NewIncomeInput {
  userId: string;
  description: string;
  amount: number;
  category: string;
  incomeDate: string;
}

/**
 * Inserta un nuevo ingreso asociado a un usuario.
 * El userId siempre viene del token JWT verificado (req.userId), nunca
 * del cuerpo de la solicitud, para que un usuario no pueda registrar
 * ingresos a nombre de otro.
 */
export async function insertIncome(input: NewIncomeInput): Promise<IncomeRecord> {
  const result = await pool.query<IncomeRecord>(
    `INSERT INTO incomes (user_id, description, amount, category, income_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, description, amount, category, income_date, created_at, updated_at`,
    [input.userId, input.description, input.amount, input.category, input.incomeDate]
  );

  return result.rows[0];
}

/**
 * Devuelve unicamente los ingresos del usuario indicado, del mas
 * reciente al mas antiguo.
 */
export async function findIncomesByUserId(userId: string): Promise<IncomeRecord[]> {
  const result = await pool.query<IncomeRecord>(
    `SELECT id, user_id, description, amount, category, income_date, created_at, updated_at
     FROM incomes
     WHERE user_id = $1
     ORDER BY income_date DESC, created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Calcula, directamente en PostgreSQL, la suma de los ingresos del
 * usuario indicado. Devuelve "0.00" cuando no tiene ningun registro
 * (COALESCE evita que SUM() devuelva NULL sobre un conjunto vacio).
 */
export async function sumIncomesByUserId(userId: string): Promise<string> {
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS total
     FROM incomes
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0]?.total ?? "0.00";
}
