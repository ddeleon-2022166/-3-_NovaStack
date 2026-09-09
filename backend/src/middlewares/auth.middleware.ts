import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error.middleware";
import {
  findSessionById,
  isSessionAbsoluteExpired,
  isSessionIdleExpired,
  revokeSession,
  UserSessionRecord,
} from "../modules/auth/models/session.model";

// Datos minimos que se guardan dentro del JWT.
// "sid" identifica la sesion correspondiente en la tabla "user_sessions"
// de PostgreSQL: sin el no hay forma de comprobar inactividad ni el
// limite absoluto de duracion en el backend.
export interface JwtPayload {
  userId: string;
  sid: string;
}

// Extiende el tipo Request de Express para adjuntar el usuario y la
// sesion autenticados.
export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
}

// Codigo de error estable que el frontend reconoce en cualquier ruta
// protegida para mostrar el modal de sesion expirada existente, sin
// depender del texto exacto del mensaje.
const SESSION_EXPIRED_CODE = "SESSION_EXPIRED";

function rejectExpiredSession(message: string): never {
  throw new AppError(message, 401, SESSION_EXPIRED_CODE);
}

/**
 * Middleware que protege rutas privadas.
 *
 * Ademas de la firma y expiracion propias del JWT, comprueba en
 * PostgreSQL que la sesion referenciada por "sid" exista, no este
 * revocada, no haya superado el tiempo de inactividad permitido
 * (SESSION_IDLE_TIMEOUT_MINUTES) y no haya alcanzado su duracion maxima
 * absoluta (SESSION_ABSOLUTE_TIMEOUT_HOURS).
 *
 * El temporizador de inactividad en Angular es solo una capa de UX para
 * mostrar el aviso sin esperar una respuesta del servidor: esta
 * comprobacion en el backend es la unica proteccion real, ya que un JWT
 * firmado valido no basta por si solo para mantener la sesion viva.
 *
 * Nunca actualiza "last_activity_at": eso ocurre unicamente en
 * POST /api/auth/session/activity, para no confundir peticiones de
 * fondo con actividad real del usuario.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("No se proporciono un token de autenticacion.", 401);
  }

  const token = authHeader.split(" ")[1];

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
  } catch {
    throw new AppError("El token es invalido o ha expirado.", 401);
  }

  if (!payload.sid) {
    throw new AppError("El token es invalido o ha expirado.", 401);
  }

  const session = await findSessionById(payload.sid);

  if (!session || session.is_revoked) {
    rejectExpiredSession("La sesion ha expirado por inactividad.");
  }

  const activeSession = session as UserSessionRecord;

  if (isSessionAbsoluteExpired(activeSession)) {
    await revokeSession(payload.sid);
    rejectExpiredSession("La sesion alcanzo su duracion maxima permitida.");
  }

  if (isSessionIdleExpired(activeSession)) {
    await revokeSession(payload.sid);
    rejectExpiredSession("La sesion ha expirado por inactividad.");
  }

  req.userId = payload.userId;
  req.sessionId = payload.sid;
  next();
}
