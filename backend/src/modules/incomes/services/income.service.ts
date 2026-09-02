import {
  IncomeRecord,
  findIncomesByUserId,
  insertIncome,
  sumIncomesByUserId,
} from "../models/income.model";
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
