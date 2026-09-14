import { Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { validateCreateIncomeInput, validateIncomeId } from "../validators/income.validator";
import {
  createIncome,
  deleteIncome,
  getIncomeSummary,
  listIncomes,
  updateIncome,
} from "../services/income.service";

/**
 * POST /api/incomes
 * Registra un nuevo ingreso para el usuario autenticado.
 * Requiere authMiddleware (adjunta req.userId a partir del JWT).
 */
export async function createIncomeController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const input = validateCreateIncomeInput(req.body);
  const income = await createIncome(userId, input);

  res.status(201).json({
    message: "Ingreso registrado correctamente.",
    income,
  });
}

/**
 * GET /api/incomes
 * Devuelve unicamente los ingresos del usuario autenticado.
 */
export async function listIncomesController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const incomes = await listIncomes(userId);

  res.status(200).json({ incomes });
}

/**
 * GET /api/incomes/summary
 * Devuelve el total de ingresos del usuario autenticado, calculado en
 * PostgreSQL ("0.00" si todavia no tiene registros).
 */
export async function incomeSummaryController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const summary = await getIncomeSummary(userId);

  res.status(200).json(summary);
}

/**
 * PUT /api/incomes/:id
 * Edita un ingreso existente del usuario autenticado. Responde 404 si el
 * registro no existe o pertenece a otro usuario.
 */
export async function updateIncomeController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateIncomeId(req.params.id);
  const input = validateCreateIncomeInput(req.body);

  const income = await updateIncome(id, userId, input);

  res.status(200).json({
    message: "Ingreso actualizado correctamente.",
    income,
  });
}

/**
 * DELETE /api/incomes/:id
 * Elimina un ingreso existente del usuario autenticado. Responde 404 si
 * el registro no existe o pertenece a otro usuario.
 */
export async function deleteIncomeController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateIncomeId(req.params.id);

  await deleteIncome(id, userId);

  res.status(200).json({ message: "Ingreso eliminado correctamente." });
}
