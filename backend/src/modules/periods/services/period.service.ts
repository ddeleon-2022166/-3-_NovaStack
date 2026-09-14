import {
  PeriodRecord,
  PeriodWithTotals,
  deletePeriodForUser,
  findActivePeriodForUser,
  findPeriodByIdForUser,
  findPeriodsWithTotalsByUserId,
  insertPeriod,
  setPeriodStatus,
  updatePeriodForUser,
  withTransaction,
} from "../models/period.model";
import { AppError } from "../../../middlewares/error.middleware";
import { CreatePeriodInput } from "../validators/period.validator";

// Forma publica de un periodo, tal como se devuelve al frontend. Los
// totales (ingresos/egresos del rango de fechas del periodo) y el
// balance ya vienen calculados desde PostgreSQL.
export interface PublicPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "activo" | "cerrado" | "planificado";
  totalIncome: string;
  totalExpense: string;
  balance: string;
  createdAt: Date;
}

function toPublicPeriod(period: PeriodWithTotals): PublicPeriod {
  const totalIncome = Number(period.total_income);
  const totalExpense = Number(period.total_expense);

  return {
    id: period.id,
    name: period.name,
    startDate: period.start_date,
    endDate: period.end_date,
    status: period.status,
    totalIncome: period.total_income,
    totalExpense: period.total_expense,
    balance: (totalIncome - totalExpense).toFixed(2),
    createdAt: period.created_at,
  };
}

function toPublicPeriodWithoutTotals(period: PeriodRecord): PublicPeriod {
  return {
    id: period.id,
    name: period.name,
    startDate: period.start_date,
    endDate: period.end_date,
    status: period.status,
    totalIncome: "0.00",
    totalExpense: "0.00",
    balance: "0.00",
    createdAt: period.created_at,
  };
}

/**
 * Registra un nuevo periodo para el usuario autenticado. Si se crea como
 * "activo" y ya existe otro periodo activo, ese otro pasa automaticamente
 * a "cerrado" dentro de la misma transaccion (regla: solo un periodo
 * activo a la vez).
 */
export async function createPeriod(userId: string, input: CreatePeriodInput): Promise<PublicPeriod> {
  if (input.status === "activo") {
    return withTransaction(async (client) => {
      const currentActive = await findActivePeriodForUser(userId, client);
      if (currentActive) {
        await setPeriodStatus(currentActive.id, "cerrado", client);
      }
      const period = await insertPeriod({
        userId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
      });
      return toPublicPeriodWithoutTotals(period);
    });
  }

  const period = await insertPeriod({
    userId,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status,
  });

  return toPublicPeriodWithoutTotals(period);
}

/** Devuelve todos los periodos del usuario autenticado, con sus totales calculados. */
export async function listPeriods(userId: string): Promise<PublicPeriod[]> {
  const periods = await findPeriodsWithTotalsByUserId(userId);
  return periods.map(toPublicPeriod);
}

/**
 * Edita un periodo existente. Igual que al crear, si se marca como
 * "activo" primero se desactiva (a "cerrado") el periodo activo actual,
 * si existe y es distinto del que se esta editando.
 * Lanza 404 si el registro no existe o no pertenece al usuario.
 */
export async function updatePeriod(
  id: string,
  userId: string,
  input: CreatePeriodInput
): Promise<PublicPeriod> {
  const existing = await findPeriodByIdForUser(id, userId);
  if (!existing) {
    throw new AppError("El periodo no existe o no te pertenece.", 404);
  }

  if (input.status === "activo") {
    return withTransaction(async (client) => {
      const currentActive = await findActivePeriodForUser(userId, client);
      if (currentActive && currentActive.id !== id) {
        await setPeriodStatus(currentActive.id, "cerrado", client);
      }
      const updated = await updatePeriodForUser(id, userId, input, client);
      return toPublicPeriodWithoutTotals(updated as PeriodRecord);
    });
  }

  const updated = await updatePeriodForUser(id, userId, input);
  return toPublicPeriodWithoutTotals(updated as PeriodRecord);
}

/**
 * Establece un periodo existente como "activo", desactivando (a
 * "cerrado") el periodo activo anterior del mismo usuario, si existe.
 * Lanza 404 si el periodo no existe o no pertenece al usuario.
 */
export async function activatePeriod(id: string, userId: string): Promise<PublicPeriod> {
  const target = await findPeriodByIdForUser(id, userId);
  if (!target) {
    throw new AppError("El periodo no existe o no te pertenece.", 404);
  }

  return withTransaction(async (client) => {
    const currentActive = await findActivePeriodForUser(userId, client);
    if (currentActive && currentActive.id !== id) {
      await setPeriodStatus(currentActive.id, "cerrado", client);
    }
    await setPeriodStatus(id, "activo", client);
    const refreshed = await findPeriodByIdForUser(id, userId);
    return toPublicPeriodWithoutTotals(refreshed as PeriodRecord);
  });
}

/**
 * Elimina un periodo existente. Lanza 404 si el registro no existe o
 * pertenece a otro usuario. No se eliminan ni desvinculan ingresos ni
 * egresos: "periods" no tiene una relacion de base de datos hacia esas
 * tablas (los totales se calculan por rango de fechas), por lo que
 * eliminar un periodo nunca borra movimientos existentes.
 */
export async function deletePeriod(id: string, userId: string): Promise<void> {
  const wasDeleted = await deletePeriodForUser(id, userId);

  if (!wasDeleted) {
    throw new AppError("El periodo no existe o no te pertenece.", 404);
  }
}
