import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";
import {
  createExpenseController,
  deleteExpenseController,
  expenseSummaryController,
  listExpensesController,
  updateExpenseController,
} from "../controllers/expense.controller";

const router = Router();

// Todas las rutas de egresos requieren un JWT y una sesion validos. Se
// aplica el mismo authMiddleware que ya protege ingresos y "/api/auth/me"
// (no se duplica).
router.use(asyncHandler(authMiddleware));

// POST /api/expenses -> registra un nuevo egreso del usuario autenticado
router.post("/", asyncHandler(createExpenseController));

// GET /api/expenses -> lista los egresos del usuario autenticado
router.get("/", asyncHandler(listExpensesController));

// GET /api/expenses/summary -> total de egresos del usuario autenticado
router.get("/summary", asyncHandler(expenseSummaryController));

// PUT /api/expenses/:id -> edita un egreso del usuario autenticado
router.put("/:id", asyncHandler(updateExpenseController));

// DELETE /api/expenses/:id -> elimina un egreso del usuario autenticado
router.delete("/:id", asyncHandler(deleteExpenseController));

export default router;
