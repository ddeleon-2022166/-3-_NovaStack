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

export interface UpdateIncomeInput {
  description: string;
  amount: number;
  category: string;
  incomeDate: string;
}

const INCOME_COLUMNS =
  "id, user_id, description, amount, category, income_date, created_at, updated_at";

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
     RETURNING ${INCOME_COLUMNS}`,
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

/**
 * Igual que sumIncomesByUserId, pero excluyendo un ingreso puntual (el
 * que se esta editando). Se usa para calcular, al editar un egreso o un
 * ingreso, cual seria el total real sin contar el registro que esta a
 * punto de reemplazarse.
 */
export async function sumIncomesByUserIdExcluding(
  userId: string,
  excludeId: string
): Promise<string> {
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS total
     FROM incomes
     WHERE user_id = $1 AND id != $2`,
    [userId, excludeId]
  );

  return result.rows[0]?.total ?? "0.00";
}

/**
 * Actualiza un ingreso, pero unicamente si pertenece al usuario indicado
 * (la clausula "AND user_id = $2" es lo que impide que alguien edite un
 * registro de otro usuario). Devuelve null si no existe o no le
 * pertenece.
 */
export async function updateIncomeForUser(
  id: string,
  userId: string,
  input: UpdateIncomeInput
): Promise<IncomeRecord | null> {
  const result = await pool.query<IncomeRecord>(
    `UPDATE incomes
     SET description = $3, amount = $4, category = $5, income_date = $6, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING ${INCOME_COLUMNS}`,
    [id, userId, input.description, input.amount, input.category, input.incomeDate]
  );

  return result.rows[0] ?? null;
}

/**
 * Elimina un ingreso, unicamente si pertenece al usuario indicado.
 * Devuelve true si algo se elimino, false si no existia o no le
 * pertenecia.
 */
export async function deleteIncomeForUser(id: string, userId: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM incomes WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);

  return (result.rowCount ?? 0) > 0;
}
