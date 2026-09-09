import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";
import {
  createIncomeController,
  incomeSummaryController,
  listIncomesController,
} from "../controllers/income.controller";

const router = Router();

// Todas las rutas de ingresos requieren un JWT y una sesion validos. Se
// aplica el mismo authMiddleware que ya protege "/api/auth/me" (no se
// duplica); se envuelve con asyncHandler porque ahora comprueba la
// sesion en PostgreSQL de forma asincrona.
router.use(asyncHandler(authMiddleware));

// POST /api/incomes -> registra un nuevo ingreso del usuario autenticado
router.post("/", asyncHandler(createIncomeController));

// GET /api/incomes -> lista los ingresos del usuario autenticado
router.get("/", asyncHandler(listIncomesController));

// GET /api/incomes/summary -> total de ingresos del usuario autenticado
router.get("/summary", asyncHandler(incomeSummaryController));

export default router;
