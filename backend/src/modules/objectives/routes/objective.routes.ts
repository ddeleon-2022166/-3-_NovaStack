import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";
import {
  createObjectiveController,
  deleteObjectiveController,
  getObjectiveController,
  listObjectivesController,
  updateObjectiveController,
  updateObjectiveProgressController,
} from "../controllers/objective.controller";

const router = Router();

// Todas las rutas de objetivos requieren un JWT y una sesion validos,
// igual que ingresos, egresos y periodos.
router.use(asyncHandler(authMiddleware));

// POST /api/objectives -> registra un nuevo objetivo del usuario autenticado
router.post("/", asyncHandler(createObjectiveController));

// GET /api/objectives -> lista los objetivos del usuario autenticado, con progreso
router.get("/", asyncHandler(listObjectivesController));

// GET /api/objectives/:id -> consulta el detalle de un objetivo
router.get("/:id", asyncHandler(getObjectiveController));

// PUT /api/objectives/:id -> edita un objetivo del usuario autenticado
router.put("/:id", asyncHandler(updateObjectiveController));

// PATCH /api/objectives/:id/progress -> registra/actualiza el monto acumulado
router.patch("/:id/progress", asyncHandler(updateObjectiveProgressController));

// DELETE /api/objectives/:id -> elimina un objetivo del usuario autenticado
router.delete("/:id", asyncHandler(deleteObjectiveController));

export default router;
