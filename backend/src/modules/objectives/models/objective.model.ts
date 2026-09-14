import { pool } from "../../../config/database";

// Representa una fila completa de la tabla "objectives", ya unida (JOIN)
// con "periods" para traer el nombre del periodo relacionado en la misma
// consulta. "target_amount" y "current_amount" llegan como texto (columnas
// NUMERIC de PostgreSQL), igual que "amount" en expenses/incomes.
export interface ObjectiveRecord {
  id: string;
  user_id: string;
  period_id: string;
  name: string;
  description: string;
  category: string;
  target_amount: string;
  current_amount: string;
  deadline: string | null;
  status: "no_iniciado" | "en_progreso" | "cumplido";
  created_at: Date;
  updated_at: Date;
  period_name: string;
}

export interface NewObjectiveInput {
  userId: string;
  periodId: string;
  name: string;
  description: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  status: ObjectiveRecord["status"];
}

export interface UpdateObjectiveInput {
  periodId: string;
  name: string;
  description: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  status: ObjectiveRecord["status"];
}

const OBJECTIVE_COLUMNS = `
  o.id, o.user_id, o.period_id, o.name, o.description, o.category,
  o.target_amount, o.current_amount, o.deadline, o.status,
  o.created_at, o.updated_at, p.name AS period_name
`;

const OBJECTIVE_FROM = `
  FROM objectives o
  INNER JOIN periods p ON p.id = o.period_id
`;

/** Inserta un nuevo objetivo asociado a un usuario y a un periodo real. */
export async function insertObjective(input: NewObjectiveInput): Promise<ObjectiveRecord> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO objectives
       (user_id, period_id, name, description, category, target_amount, current_amount, deadline, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.userId,
      input.periodId,
      input.name,
      input.description,
      input.category,
      input.targetAmount,
      input.currentAmount,
      input.deadline,
      input.status,
    ]
  );

  const created = await findObjectiveByIdForUser(inserted.rows[0].id, input.userId);
  return created as ObjectiveRecord;
}

/** Devuelve todos los objetivos del usuario indicado, con el nombre de su periodo. */
export async function findObjectivesByUserId(userId: string): Promise<ObjectiveRecord[]> {
  const result = await pool.query<ObjectiveRecord>(
    `SELECT ${OBJECTIVE_COLUMNS} ${OBJECTIVE_FROM}
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );

  return result.rows;
}

/** Busca un objetivo puntual, solo si pertenece al usuario indicado. */
export async function findObjectiveByIdForUser(
  id: string,
  userId: string
): Promise<ObjectiveRecord | null> {
  const result = await pool.query<ObjectiveRecord>(
    `SELECT ${OBJECTIVE_COLUMNS} ${OBJECTIVE_FROM}
     WHERE o.id = $1 AND o.user_id = $2`,
    [id, userId]
  );

  return result.rows[0] ?? null;
}

/**
 * Comprueba que un periodo exista y pertenezca al usuario indicado.
 * Se usa al crear/editar un objetivo, para no permitir enlazarlo a un
 * periodo inexistente o de otro usuario.
 */
export async function periodBelongsToUser(periodId: string, userId: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM periods WHERE id = $1 AND user_id = $2", [
    periodId,
    userId,
  ]);

  return (result.rowCount ?? 0) > 0;
}

/** Actualiza un objetivo, solo si pertenece al usuario indicado. */
export async function updateObjectiveForUser(
  id: string,
  userId: string,
  input: UpdateObjectiveInput
): Promise<ObjectiveRecord | null> {
  const result = await pool.query(
    `UPDATE objectives
     SET period_id = $3, name = $4, description = $5, category = $6,
         target_amount = $7, current_amount = $8, deadline = $9, status = $10,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [
      id,
      userId,
      input.periodId,
      input.name,
      input.description,
      input.category,
      input.targetAmount,
      input.currentAmount,
      input.deadline,
      input.status,
    ]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return findObjectiveByIdForUser(id, userId);
}

/**
 * Actualiza unicamente el monto acumulado (y, con el, el estado) de un
 * objetivo existente. Se usa para "registrar o actualizar el progreso"
 * sin tener que reenviar el resto de los campos del objetivo.
 */
export async function updateObjectiveProgressForUser(
  id: string,
  userId: string,
  currentAmount: number,
  status: ObjectiveRecord["status"]
): Promise<ObjectiveRecord | null> {
  const result = await pool.query(
    `UPDATE objectives
     SET current_amount = $3, status = $4, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId, currentAmount, status]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return findObjectiveByIdForUser(id, userId);
}

/** Elimina un objetivo, unicamente si pertenece al usuario indicado. */
export async function deleteObjectiveForUser(id: string, userId: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM objectives WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);

  return (result.rowCount ?? 0) > 0;
}
