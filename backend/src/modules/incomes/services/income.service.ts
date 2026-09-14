import {
  IncomeRecord,
  deleteIncomeForUser,
  findIncomesByUserId,
  insertIncome,
  sumIncomesByUserId,
  updateIncomeForUser,
} from "../models/income.model";
import { AppError } from "../../../middlewares/error.middleware";
import { CreateIncomeInput } from "../validators/income.validator";

// Forma publica de un ingreso, tal como se devuelve al frontend.
export interface PublicIncome {
  id: string;
  description: string;
  amount: string;
  category: string;
  incomeDate: string;
  createdAt: Date;
}

function toPublicIncome(income: IncomeRecord): PublicIncome {
  return {
    id: income.id,
    description: income.description,
    amount: income.amount,
    category: income.category,
    incomeDate: income.income_date,
    createdAt: income.created_at,
  };
}

/**
 * Registra un nuevo ingreso para el usuario autenticado.
 * El userId se recibe como parametro separado (no como parte de
 * CreateIncomeInput) para dejar explicito que siempre proviene del JWT
 * verificado, nunca del cuerpo de la solicitud.
 */
export async function createIncome(
  userId: string,
  input: CreateIncomeInput
): Promise<PublicIncome> {
  const income = await insertIncome({
    userId,
    description: input.description,
    amount: input.amount,
    category: input.category,
    incomeDate: input.incomeDate,
  });

  return toPublicIncome(income);
}

/**
 * Devuelve la lista de ingresos del usuario autenticado, del mas
 * reciente al mas antiguo.
 */
export async function listIncomes(userId: string): Promise<PublicIncome[]> {
  const incomes = await findIncomesByUserId(userId);
  return incomes.map(toPublicIncome);
}

/**
 * Calcula el resumen (total) de ingresos del usuario autenticado,
 * directamente desde PostgreSQL.
 */
export async function getIncomeSummary(userId: string): Promise<{ total: string }> {
  const total = await sumIncomesByUserId(userId);
  return { total };
}

/**
 * Edita un ingreso existente. Lanza 404 si el registro no existe o no
 * pertenece al usuario autenticado (el modelo ya filtra por user_id, asi
 * que ambos casos llegan aqui de la misma forma).
 */
export async function updateIncome(
  id: string,
  userId: string,
  input: CreateIncomeInput
): Promise<PublicIncome> {
  const updated = await updateIncomeForUser(id, userId, {
    description: input.description,
    amount: input.amount,
    category: input.category,
    incomeDate: input.incomeDate,
  });

  if (!updated) {
    throw new AppError("El ingreso no existe o no te pertenece.", 404);
  }

  return toPublicIncome(updated);
}

/**
 * Elimina un ingreso existente. Lanza 404 si el registro no existe o no
 * pertenece al usuario autenticado.
 */
export async function deleteIncome(id: string, userId: string): Promise<void> {
  const wasDeleted = await deleteIncomeForUser(id, userId);

  if (!wasDeleted) {
    throw new AppError("El ingreso no existe o no te pertenece.", 404);
  }
}
