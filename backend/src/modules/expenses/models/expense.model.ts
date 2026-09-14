import { pool } from "../../../config/database";

// Representa una fila completa de la tabla "expenses". "amount" llega
// como texto (columna NUMERIC de PostgreSQL) y "expense_date" como texto
// en formato "AAAA-MM-DD".
export interface ExpenseRecord {
  id: string;
  user_id: string;
  description: string;
  amount: string;
  category: string;
  expense_date: string;
  created_at: Date;
  updated_at: Date;
}

export interface NewExpenseInput {
  userId: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
}

export interface UpdateExpenseInput {
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
}

const EXPENSE_COLUMNS =
  "id, user_id, description, amount, category, expense_date, created_at, updated_at";

/**
 * Inserta un nuevo egreso asociado a un usuario.
 * El userId siempre viene del token JWT verificado (req.userId), nunca
 * del cuerpo de la solicitud.
 */
export async function insertExpense(input: NewExpenseInput): Promise<ExpenseRecord> {
  const result = await pool.query<ExpenseRecord>(
    `INSERT INTO expenses (user_id, description, amount, category, expense_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${EXPENSE_COLUMNS}`,
    [input.userId, input.description, input.amount, input.category, input.expenseDate]
  );

  return result.rows[0];
}

/** Devuelve unicamente los egresos del usuario indicado, del mas reciente al mas antiguo. */
export async function findExpensesByUserId(userId: string): Promise<ExpenseRecord[]> {
  const result = await pool.query<ExpenseRecord>(
    `SELECT ${EXPENSE_COLUMNS}
     FROM expenses
     WHERE user_id = $1
     ORDER BY expense_date DESC, created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Calcula, directamente en PostgreSQL, la suma de los egresos del
 * usuario indicado. Devuelve "0.00" cuando no tiene ningun registro.
 */
export async function sumExpensesByUserId(userId: string): Promise<string> {
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS total
     FROM expenses
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0]?.total ?? "0.00";
}

/**
 * Igual que sumExpensesByUserId, pero excluyendo un egreso puntual (el
 * que se esta editando). Se usa para calcular, al editar un egreso, cual
 * seria el total de egresos sin contar el registro que esta a punto de
 * reemplazarse, y asi comprobar el saldo disponible correctamente.
 */
export async function sumExpensesByUserIdExcluding(
  userId: string,
  excludeId: string
): Promise<string> {
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS total
     FROM expenses
     WHERE user_id = $1 AND id != $2`,
    [userId, excludeId]
  );

  return result.rows[0]?.total ?? "0.00";
}

/**
 * Actualiza un egreso, pero unicamente si pertenece al usuario indicado
 * (la clausula "AND user_id = $2" es lo que impide que alguien edite un
 * registro de otro usuario). Devuelve null si no existe o no le
 * pertenece, para que el controlador responda 404 sin distinguir cual de
 * los dos casos fue.
 */
export async function updateExpenseForUser(
  id: string,
  userId: string,
  input: UpdateExpenseInput
): Promise<ExpenseRecord | null> {
  const result = await pool.query<ExpenseRecord>(
    `UPDATE expenses
     SET description = $3, amount = $4, category = $5, expense_date = $6, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING ${EXPENSE_COLUMNS}`,
    [id, userId, input.description, input.amount, input.category, input.expenseDate]
  );

  return result.rows[0] ?? null;
}

/**
 * Elimina un egreso, unicamente si pertenece al usuario indicado.
 * Devuelve true si algo se elimino, false si no existia o no le
 * pertenecia.
 */
export async function deleteExpenseForUser(id: string, userId: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM expenses WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);

  return (result.rowCount ?? 0) > 0;
}
