import { Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { validateExpenseId, validateExpenseInput } from "../validators/expense.validator";
import {
  createExpense,
  deleteExpense,
  getExpenseSummary,
  listExpenses,
  updateExpense,
} from "../services/expense.service";

/**
 * POST /api/expenses
 * Registra un nuevo egreso para el usuario autenticado.
 */
export async function createExpenseController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const input = validateExpenseInput(req.body);
  const expense = await createExpense(userId, input);

  res.status(201).json({
    message: "Egreso registrado correctamente.",
    expense,
  });
}

/**
 * GET /api/expenses
 * Devuelve unicamente los egresos del usuario autenticado.
 */
export async function listExpensesController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const expenses = await listExpenses(userId);

  res.status(200).json({ expenses });
}

/**
 * GET /api/expenses/summary
 * Devuelve el total de egresos del usuario autenticado, calculado en
 * PostgreSQL ("0.00" si todavia no tiene registros).
 */
export async function expenseSummaryController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const summary = await getExpenseSummary(userId);

  res.status(200).json(summary);
}

/**
 * PUT /api/expenses/:id
 * Edita un egreso existente del usuario autenticado. Responde 404 si el
 * registro no existe o pertenece a otro usuario.
 */
export async function updateExpenseController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateExpenseId(req.params.id);
  const input = validateExpenseInput(req.body);

  const expense = await updateExpense(id, userId, input);

  res.status(200).json({
    message: "Egreso actualizado correctamente.",
    expense,
  });
}

/**
 * DELETE /api/expenses/:id
 * Elimina un egreso existente del usuario autenticado. Responde 404 si
 * el registro no existe o pertenece a otro usuario.
 */
export async function deleteExpenseController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateExpenseId(req.params.id);

  await deleteExpense(id, userId);

  res.status(200).json({ message: "Egreso eliminado correctamente." });
}
