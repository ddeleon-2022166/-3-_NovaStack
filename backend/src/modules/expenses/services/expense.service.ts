import {
  ExpenseRecord,
  deleteExpenseForUser,
  findExpensesByUserId,
  insertExpense,
  sumExpensesByUserId,
  sumExpensesByUserIdExcluding,
  updateExpenseForUser,
} from "../models/expense.model";
import { sumIncomesByUserId } from "../../incomes/models/income.model";
import { AppError } from "../../../middlewares/error.middleware";
import { ExpenseInput } from "../validators/expense.validator";

// Forma publica de un egreso, tal como se devuelve al frontend.
export interface PublicExpense {
  id: string;
  description: string;
  amount: string;
  category: string;
  expenseDate: string;
  createdAt: Date;
}

function toPublicExpense(expense: ExpenseRecord): PublicExpense {
  return {
    id: expense.id,
    description: expense.description,
    amount: expense.amount,
    category: expense.category,
    expenseDate: expense.expense_date,
    createdAt: expense.created_at,
  };
}

/**
 * Comprueba que el usuario tenga saldo suficiente para un egreso de este
 * monto, antes de guardarlo. El saldo disponible se calcula como
 * "ingresos totales - egresos totales (sin contar, si aplica, el egreso
 * que se esta editando)", exactamente la misma formula que usa el
 * Dashboard para el presupuesto restante (ver dashboard.component.ts en
 * el frontend), para que ambos numeros siempre coincidan.
 *
 * Nunca permite que el usuario registre un egreso mayor a su saldo
 * disponible: el presupuesto restante nunca debe volverse negativo.
 */
async function assertSufficientFunds(
  userId: string,
  amount: number,
  otherExpensesTotal: string
): Promise<void> {
  const incomeTotal = Number(await sumIncomesByUserId(userId));
  const availableBalance = incomeTotal - Number(otherExpensesTotal);

  if (amount > availableBalance) {
    const formattedAvailable = Math.max(availableBalance, 0).toFixed(2);
    throw new AppError(
      `No cuenta con fondos suficientes para registrar este egreso. Su presupuesto disponible es de Q${formattedAvailable}.`,
      400
    );
  }
}

/** Registra un nuevo egreso para el usuario autenticado. */
export async function createExpense(
  userId: string,
  input: ExpenseInput
): Promise<PublicExpense> {
  const currentExpensesTotal = await sumExpensesByUserId(userId);
  await assertSufficientFunds(userId, input.amount, currentExpensesTotal);

  const expense = await insertExpense({
    userId,
    description: input.description,
    amount: input.amount,
    category: input.category,
    expenseDate: input.expenseDate,
  });

  return toPublicExpense(expense);
}

/** Devuelve la lista de egresos del usuario autenticado, del mas reciente al mas antiguo. */
export async function listExpenses(userId: string): Promise<PublicExpense[]> {
  const expenses = await findExpensesByUserId(userId);
  return expenses.map(toPublicExpense);
}

/** Calcula el resumen (total) de egresos del usuario autenticado, directamente desde PostgreSQL. */
export async function getExpenseSummary(userId: string): Promise<{ total: string }> {
  const total = await sumExpensesByUserId(userId);
  return { total };
}

/**
 * Edita un egreso existente. Lanza 404 si el registro no existe o no
 * pertenece al usuario autenticado (el modelo ya filtra por user_id, asi
 * que ambos casos llegan aqui de la misma forma).
 */
export async function updateExpense(
  id: string,
  userId: string,
  input: ExpenseInput
): Promise<PublicExpense> {
  const otherExpensesTotal = await sumExpensesByUserIdExcluding(userId, id);
  await assertSufficientFunds(userId, input.amount, otherExpensesTotal);

  const updated = await updateExpenseForUser(id, userId, {
    description: input.description,
    amount: input.amount,
    category: input.category,
    expenseDate: input.expenseDate,
  });

  if (!updated) {
    throw new AppError("El egreso no existe o no le pertenece.", 404);
  }

  return toPublicExpense(updated);
}

/**
 * Elimina un egreso existente. Lanza 404 si el registro no existe o no
 * pertenece al usuario autenticado.
 */
export async function deleteExpense(id: string, userId: string): Promise<void> {
  const wasDeleted = await deleteExpenseForUser(id, userId);

  if (!wasDeleted) {
    throw new AppError("El egreso no existe o no le pertenece.", 404);
  }
}
