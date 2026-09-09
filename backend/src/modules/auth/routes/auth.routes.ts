import { Router } from "express";
import { googleController, loginController, meController } from "../controllers/auth.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";

const router = Router();

// POST /api/auth/login -> inicia sesion y devuelve un JWT
router.post("/login", asyncHandler(loginController));

// POST /api/auth/google -> inicia sesion con Google (verifica el ID token
// en el backend) y devuelve el mismo JWT interno que el login tradicional
router.post("/google", asyncHandler(googleController));

// GET /api/auth/me -> ruta protegida, requiere JWT valido
router.get("/me", authMiddleware, asyncHandler(meController));

export default router;
