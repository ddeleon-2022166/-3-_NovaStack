import { Router } from "express";
import { loginController, meController } from "../controllers/auth.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";

const router = Router();

// POST /api/auth/login -> inicia sesion y devuelve un JWT
router.post("/login", asyncHandler(loginController));

// GET /api/auth/me -> ruta protegida, requiere JWT valido
router.get("/me", authMiddleware, asyncHandler(meController));

export default router;
