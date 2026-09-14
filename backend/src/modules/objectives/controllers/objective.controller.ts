import { Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import {
  validateObjectiveId,
  validateObjectiveInput,
  validateObjectiveProgressInput,
} from "../validators/objective.validator";
import {
  createObjective,
  deleteObjective,
  getObjective,
  listObjectives,
  updateObjective,
  updateObjectiveProgress,
} from "../services/objective.service";

/**
 * POST /api/objectives
 * Registra un nuevo objetivo para el usuario autenticado.
 */
export async function createObjectiveController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const input = validateObjectiveInput(req.body);
  const objective = await createObjective(userId, input);

  res.status(201).json({
    message: "Objetivo creado correctamente.",
    objective,
  });
}

/**
 * GET /api/objectives
 * Devuelve los objetivos del usuario autenticado, con su progreso ya calculado.
 */
export async function listObjectivesController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const objectives = await listObjectives(userId);

  res.status(200).json({ objectives });
}

/**
 * GET /api/objectives/:id
 * Devuelve el detalle de un objetivo existente del usuario autenticado.
 */
export async function getObjectiveController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateObjectiveId(req.params.id);
  const objective = await getObjective(id, userId);

  res.status(200).json({ objective });
}

/**
 * PUT /api/objectives/:id
 * Edita un objetivo existente del usuario autenticado.
 */
export async function updateObjectiveController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateObjectiveId(req.params.id);
  const input = validateObjectiveInput(req.body);

  const objective = await updateObjective(id, userId, input);

  res.status(200).json({
    message: "Objetivo actualizado correctamente.",
    objective,
  });
}

/**
 * PATCH /api/objectives/:id/progress
 * Registra o actualiza unicamente el monto acumulado de un objetivo.
 */
export async function updateObjectiveProgressController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateObjectiveId(req.params.id);
  const input = validateObjectiveProgressInput(req.body);

  const objective = await updateObjectiveProgress(id, userId, input);

  res.status(200).json({
    message: "Progreso del objetivo actualizado correctamente.",
    objective,
  });
}

/**
 * DELETE /api/objectives/:id
 * Elimina un objetivo existente del usuario autenticado.
 */
export async function deleteObjectiveController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId as string;
  const id = validateObjectiveId(req.params.id);

  await deleteObjective(id, userId);

  res.status(200).json({ message: "Objetivo eliminado correctamente." });
}
