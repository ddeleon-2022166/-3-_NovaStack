import { Request, Response } from "express";
import { validateGoogleAuthInput, validateLoginInput } from "../validators/auth.validator";
import { login, loginWithGoogle } from "../services/auth.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { getPublicUserById } from "../../users/services/user.service";

/**
 * POST /api/auth/login
 * Autentica a un usuario existente y devuelve un JWT.
 */
export async function loginController(req: Request, res: Response): Promise<void> {
  const credentials = validateLoginInput(req.body);
  const result = await login(credentials);

  res.status(200).json({
    message: "Inicio de sesion exitoso.",
    token: result.token,
    user: result.user,
  });
}

/**
 * POST /api/auth/google
 * Verifica el ID token de Google Identity Services, crea o reutiliza el
 * usuario correspondiente en PostgreSQL, y devuelve el JWT interno de
 * NovaStack en el mismo formato que el login tradicional.
 */
export async function googleController(req: Request, res: Response): Promise<void> {
  const credentials = validateGoogleAuthInput(req.body);
  const result = await loginWithGoogle(credentials);

  res.status(200).json({
    message: "Inicio de sesion exitoso.",
    token: result.token,
    user: result.user,
  });
}

/**
 * GET /api/auth/me
 * Ruta protegida: devuelve los datos publicos del usuario autenticado.
 * Requiere el middleware authMiddleware, que adjunta req.userId.
 */
export async function meController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId as string;
  const user = await getPublicUserById(userId);

  res.status(200).json({ user });
}
