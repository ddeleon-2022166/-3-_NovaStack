import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";
import {
  activatePeriodController,
  createPeriodController,
  deletePeriodController,
  listPeriodsController,
  updatePeriodController,
} from "../controllers/period.controller";

const router = Router();

// Todas las rutas de periodos requieren un JWT y una sesion validos,
// igual que ingresos y egresos.
router.use(asyncHandler(authMiddleware));

// POST /api/periods -> registra un nuevo periodo del usuario autenticado
router.post("/", asyncHandler(createPeriodController));

// GET /api/periods -> lista los periodos del usuario autenticado, con totales
router.get("/", asyncHandler(listPeriodsController));

// PATCH /api/periods/:id/activate -> establece un periodo como activo
router.patch("/:id/activate", asyncHandler(activatePeriodController));

// PUT /api/periods/:id -> edita un periodo del usuario autenticado
router.put("/:id", asyncHandler(updatePeriodController));

// DELETE /api/periods/:id -> elimina un periodo del usuario autenticado
router.delete("/:id", asyncHandler(deletePeriodController));

export default router;
