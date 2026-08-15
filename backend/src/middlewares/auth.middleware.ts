import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error.middleware";

// Datos minimos que se guardan dentro del JWT
export interface JwtPayload {
  userId: string;
}

// Extiende el tipo Request de Express para adjuntar el usuario autenticado
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Middleware que protege rutas privadas.
 * Verifica el encabezado "Authorization: Bearer <token>",
 * valida la firma y expiracion del JWT, y adjunta el userId a la request.
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("No se proporciono un token de autenticacion.", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.userId = payload.userId;
    next();
  } catch {
    throw new AppError("El token es invalido o ha expirado.", 401);
  }
}
