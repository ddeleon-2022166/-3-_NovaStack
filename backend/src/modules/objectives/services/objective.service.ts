import { AppError } from "../../../middlewares/error.middleware";
import {
  ObjectiveRecord,
  deleteObjectiveForUser,
  findObjectiveByIdForUser,
  findObjectivesByUserId,
  insertObjective,
  periodBelongsToUser,
  updateObjectiveForUser,
  updateObjectiveProgressForUser,
} from "../models/objective.model";
import { ObjectiveInput, ObjectiveProgressInput } from "../validators/objective.validator";

export type ObjectiveStatus = "no_iniciado" | "en_progreso" | "cumplido";

// Forma publica de un objetivo, tal como se devuelve al frontend. El
// progreso (porcentaje) se calcula aqui, en el backend, a partir de
// current_amount / target_amount: el frontend nunca hace esta division,
// solo la muestra (ver ObjectivesComponent, que tampoco usa Math en la
// plantilla).
export interface PublicObjective {
  id: string;
  periodId: string;
  periodName: string;
  name: string;
  description: string;
  category: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  status: ObjectiveStatus;
  progressPercentage: number;
  createdAt: Date;
}

/**
 * Calcula el estado real de un objetivo a partir de sus montos. Nunca se
 * confia en un estado enviado por el cliente: se recalcula siempre aqui,
 * para que el listado, las tarjetas de resumen y el detalle nunca puedan
 * mostrar un estado desincronizado del progreso real.
 */
function computeStatus(currentAmount: number, targetAmount: number): ObjectiveStatus {
  if (currentAmount >= targetAmount) {
    return "cumplido";
  }
  if (currentAmount > 0) {
    return "en_progreso";
  }
  return "no_iniciado";
}

/**
 * Calcula el porcentaje de progreso (0-100, sin decimales) de un
 * objetivo. Nunca supera 100, incluso si, por alguna razon, el monto
 * acumulado quedara por encima de la meta.
 */
function computeProgressPercentage(currentAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) {
    return 0;
  }
  const rawPercentage = (currentAmount / targetAmount) * 100;
  return Math.min(100, Math.round(rawPercentage));
}

function toPublicObjective(objective: ObjectiveRecord): PublicObjective {
  const targetAmount = Number(objective.target_amount);
  const currentAmount = Number(objective.current_amount);

  return {
    id: objective.id,
    periodId: objective.period_id,
    periodName: objective.period_name,
    name: objective.name,
    description: objective.description,
    category: objective.category,
    targetAmount: objective.target_amount,
    currentAmount: objective.current_amount,
    deadline: objective.deadline,
    status: objective.status,
    progressPercentage: computeProgressPercentage(currentAmount, targetAmount),
    createdAt: objective.created_at,
  };
}

/** Comprueba que el periodo enviado exista y pertenezca al usuario autenticado. */
async function assertPeriodBelongsToUser(periodId: string, userId: string): Promise<void> {
  const belongs = await periodBelongsToUser(periodId, userId);
  if (!belongs) {
    throw new AppError("El periodo seleccionado no existe o no te pertenece.", 400);
  }
}

/** Registra un nuevo objetivo para el usuario autenticado. */
export async function createObjective(
  userId: string,
  input: ObjectiveInput
): Promise<PublicObjective> {
  await assertPeriodBelongsToUser(input.periodId, userId);

  const status = computeStatus(input.currentAmount, input.targetAmount);

  const objective = await insertObjective({
    userId,
    periodId: input.periodId,
    name: input.name,
    description: input.description,
    category: input.category,
    targetAmount: input.targetAmount,
    currentAmount: input.currentAmount,
    deadline: input.deadline,
    status,
  });

  return toPublicObjective(objective);
}

/** Devuelve todos los objetivos del usuario autenticado, mas recientes primero. */
export async function listObjectives(userId: string): Promise<PublicObjective[]> {
  const objectives = await findObjectivesByUserId(userId);
  return objectives.map(toPublicObjective);
}

/** Devuelve un objetivo puntual del usuario autenticado. Lanza 404 si no existe. */
export async function getObjective(id: string, userId: string): Promise<PublicObjective> {
  const objective = await findObjectiveByIdForUser(id, userId);
  if (!objective) {
    throw new AppError("El objetivo no existe o no te pertenece.", 404);
  }
  return toPublicObjective(objective);
}

/** Edita un objetivo existente del usuario autenticado. Lanza 404 si no existe. */
export async function updateObjective(
  id: string,
  userId: string,
  input: ObjectiveInput
): Promise<PublicObjective> {
  const existing = await findObjectiveByIdForUser(id, userId);
  if (!existing) {
    throw new AppError("El objetivo no existe o no te pertenece.", 404);
  }

  await assertPeriodBelongsToUser(input.periodId, userId);

  const status = computeStatus(input.currentAmount, input.targetAmount);

  const updated = await updateObjectiveForUser(id, userId, {
    periodId: input.periodId,
    name: input.name,
    description: input.description,
    category: input.category,
    targetAmount: input.targetAmount,
    currentAmount: input.currentAmount,
    deadline: input.deadline,
    status,
  });

  return toPublicObjective(updated as ObjectiveRecord);
}

/**
 * Actualiza unicamente el monto acumulado de un objetivo existente
 * (registrar avance de ahorro), recalculando su estado. El monto nunca
 * se deja superar la meta: si el usuario reporta mas de lo que faltaba,
 * se guarda como el 100% (igual que la regla aplicada al crear/editar).
 */
export async function updateObjectiveProgress(
  id: string,
  userId: string,
  input: ObjectiveProgressInput
): Promise<PublicObjective> {
  const existing = await findObjectiveByIdForUser(id, userId);
  if (!existing) {
    throw new AppError("El objetivo no existe o no te pertenece.", 404);
  }

  const targetAmount = Number(existing.target_amount);
  const cappedCurrent = Math.min(input.currentAmount, targetAmount);
  const status = computeStatus(cappedCurrent, targetAmount);

  const updated = await updateObjectiveProgressForUser(id, userId, cappedCurrent, status);

  return toPublicObjective(updated as ObjectiveRecord);
}

/** Elimina un objetivo existente del usuario autenticado. Lanza 404 si no existe. */
export async function deleteObjective(id: string, userId: string): Promise<void> {
  const wasDeleted = await deleteObjectiveForUser(id, userId);
  if (!wasDeleted) {
    throw new AppError("El objetivo no existe o no te pertenece.", 404);
  }
}
