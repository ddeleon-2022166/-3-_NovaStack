import { Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { validateCreatePeriodInput, validatePeriodId } from "../validators/period.validator";
import {
  activatePeriod,
  createPeriod,
  deletePeriod,
  listPeriods,
  updatePeriod,
} from "../services/period.service";

/**
 * POST /api/periods
 * Registra un nuevo periodo para el usuario autenticado.
 */
export async function createPeriodController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const input = validateCreatePeriodInput(req.body);
  const period = await createPeriod(userId, input);

  res.status(201).json({
    message: "Periodo creado correctamente.",
    period,
  });
}

/**
 * GET /api/periods
 * Devuelve los periodos del usuario autenticado, con sus totales de
 * ingresos, egresos y balance ya calculados.
 */
export async function listPeriodsController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const periods = await listPeriods(userId);

  res.status(200).json({ periods });
}

/**
 * PUT /api/periods/:id
 * Edita un periodo existente del usuario autenticado.
 */
export async function updatePeriodController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validatePeriodId(req.params.id);
  const input = validateCreatePeriodInput(req.body);

  const period = await updatePeriod(id, userId, input);

  res.status(200).json({
    message: "Periodo actualizado correctamente.",
    period,
  });
}

/**
 * PATCH /api/periods/:id/activate
 * Establece un periodo existente como el periodo activo del usuario
 * autenticado (desactivando, si existe, el periodo activo anterior).
 */
export async function activatePeriodController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validatePeriodId(req.params.id);

  const period = await activatePeriod(id, userId);

  res.status(200).json({
    message: "Periodo establecido como activo correctamente.",
    period,
  });
}

/**
 * DELETE /api/periods/:id
 * Elimina un periodo existente del usuario autenticado.
 */
export async function deletePeriodController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validatePeriodId(req.params.id);

  await deletePeriod(id, userId);

  res.status(200).json({ message: "Periodo eliminado correctamente." });
}
