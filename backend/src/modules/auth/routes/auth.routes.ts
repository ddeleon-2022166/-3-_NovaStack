import { Router } from "express";
import {
  googleController,
  loginController,
  logoutController,
  meController,
  sessionActivityController,
} from "../controllers/auth.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/async-handler";

const router = Router();

// POST /api/auth/login -> inicia sesion y devuelve un JWT
router.post("/login", asyncHandler(loginController));

// POST /api/auth/google -> inicia sesion con Google (verifica el ID token
// en el backend) y devuelve el mismo JWT interno que el login tradicional
router.post("/google", asyncHandler(googleController));

// GET /api/auth/me -> ruta protegida, requiere JWT y sesion validos
router.get("/me", asyncHandler(authMiddleware), asyncHandler(meController));

// POST /api/auth/session/activity -> ruta protegida, renueva la sesion
// ante actividad real del usuario y emite un JWT nuevo
router.post(
  "/session/activity",
  asyncHandler(authMiddleware),
  asyncHandler(sessionActivityController)
);

// POST /api/auth/logout -> ruta protegida, revoca la sesion actual
router.post("/logout", asyncHandler(authMiddleware), asyncHandler(logoutController));

export default router;
