import { Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { validateCreateIncomeInput } from "../validators/income.validator";
import { createIncome, getIncomeSummary, listIncomes } from "../services/income.service";

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
