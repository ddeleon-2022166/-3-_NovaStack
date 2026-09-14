import { PoolClient } from "pg";
import { pool } from "../../../config/database";

// Representa una fila completa de la tabla "periods", con los totales
// de ingresos/egresos ya calculados por rango de fecha (no son columnas
// reales de "periods": vienen de subconsultas contra "incomes" y
// "expenses", ver findPeriodsWithTotalsByUserId).
export interface PeriodRecord {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "activo" | "cerrado" | "planificado";
  created_at: Date;
  updated_at: Date;
}

export interface PeriodWithTotals extends PeriodRecord {
  total_income: string;
  total_expense: string;
}

export interface NewPeriodInput {
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "activo" | "cerrado" | "planificado";
}

export interface UpdatePeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  status: "activo" | "cerrado" | "planificado";
}

const PERIOD_COLUMNS = "id, user_id, name, start_date, end_date, status, created_at, updated_at";
const PERIOD_COLUMNS_PREFIXED =
  "p.id, p.user_id, p.name, p.start_date, p.end_date, p.status, p.created_at, p.updated_at";

// Subconsultas que calculan, para un periodo dado, la suma de ingresos y
// egresos del mismo usuario cuya fecha cae dentro de [start_date, end_date].
// No se crea ninguna columna ni tabla intermedia: el calculo ocurre en
// PostgreSQL en el momento de la consulta.
const TOTALS_SELECT = `
  COALESCE((
    SELECT SUM(i.amount) FROM incomes i
    WHERE i.user_id = p.user_id AND i.income_date BETWEEN p.start_date AND p.end_date
  ), 0)::numeric(12,2) AS total_income,
  COALESCE((
    SELECT SUM(e.amount) FROM expenses e
    WHERE e.user_id = p.user_id AND e.expense_date BETWEEN p.start_date AND p.end_date
  ), 0)::numeric(12,2) AS total_expense
`;

/**
 * Inserta un nuevo periodo asociado a un usuario. Si status = "activo"
 * y ya existe otro periodo activo del mismo usuario, la transaccion
 * llamante (ver period.service.ts) debe haberlo desactivado antes.
 */
export async function insertPeriod(input: NewPeriodInput): Promise<PeriodRecord> {
  const result = await pool.query<PeriodRecord>(
    `INSERT INTO periods (user_id, name, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PERIOD_COLUMNS}`,
    [input.userId, input.name, input.startDate, input.endDate, input.status]
  );

  return result.rows[0];
}

/**
 * Devuelve todos los periodos del usuario indicado, del mas reciente al
 * mas antiguo (por fecha de inicio), junto con sus totales calculados.
 */
export async function findPeriodsWithTotalsByUserId(userId: string): Promise<PeriodWithTotals[]> {
  const result = await pool.query<PeriodWithTotals>(
    `SELECT ${PERIOD_COLUMNS_PREFIXED}, ${TOTALS_SELECT}
     FROM periods p
     WHERE p.user_id = $1
     ORDER BY p.start_date DESC, p.created_at DESC`,
    [userId]
  );

  return result.rows;
}

/** Busca un periodo puntual, solo si pertenece al usuario indicado. */
export async function findPeriodByIdForUser(id: string, userId: string): Promise<PeriodRecord | null> {
  const result = await pool.query<PeriodRecord>(
    `SELECT ${PERIOD_COLUMNS} FROM periods WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rows[0] ?? null;
}

/**
 * Busca el periodo activo del usuario indicado (o null si no tiene
 * ninguno). Se usa para desactivarlo antes de activar otro.
 */
export async function findActivePeriodForUser(
  userId: string,
  client?: PoolClient
): Promise<PeriodRecord | null> {
  const runner = client ?? pool;
  const result = await runner.query<PeriodRecord>(
    `SELECT ${PERIOD_COLUMNS} FROM periods WHERE user_id = $1 AND status = 'activo' LIMIT 1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

/** Cambia el estado de un periodo puntual (usado para desactivar el periodo activo anterior). */
export async function setPeriodStatus(
  id: string,
  status: PeriodRecord["status"],
  client?: PoolClient
): Promise<void> {
  const runner = client ?? pool;
  await runner.query(`UPDATE periods SET status = $2, updated_at = NOW() WHERE id = $1`, [
    id,
    status,
  ]);
}

/** Actualiza un periodo, solo si pertenece al usuario indicado. */
export async function updatePeriodForUser(
  id: string,
  userId: string,
  input: UpdatePeriodInput,
  client?: PoolClient
): Promise<PeriodRecord | null> {
  const runner = client ?? pool;
  const result = await runner.query<PeriodRecord>(
    `UPDATE periods
     SET name = $3, start_date = $4, end_date = $5, status = $6, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING ${PERIOD_COLUMNS}`,
    [id, userId, input.name, input.startDate, input.endDate, input.status]
  );

  return result.rows[0] ?? null;
}

/** Elimina un periodo, unicamente si pertenece al usuario indicado. */
export async function deletePeriodForUser(id: string, userId: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM periods WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);

  return (result.rowCount ?? 0) > 0;
}

/** Ejecuta un callback dentro de una transaccion (usado al activar un periodo). */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
