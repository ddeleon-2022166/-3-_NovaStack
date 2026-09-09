import { pool } from "../../../config/database";
import { env } from "../../../config/env";

// Representa una fila completa de la tabla "user_sessions".
export interface UserSessionRecord {
  id: string;
  user_id: string;
  created_at: Date;
  last_activity_at: Date;
  absolute_expires_at: Date;
  is_revoked: boolean;
  revoked_at: Date | null;
}

const SESSION_COLUMNS =
  "id, user_id, created_at, last_activity_at, absolute_expires_at, is_revoked, revoked_at";

/**
 * Crea una nueva sesion en PostgreSQL para el usuario indicado.
 * Se invoca en cada inicio de sesion exitoso (tradicional o con Google):
 * cada login crea una sesion propia, nunca se reutiliza una existente.
 *
 * "absolute_expires_at" se calcula una unica vez aqui, a partir de
 * SESSION_ABSOLUTE_TIMEOUT_HOURS, y nunca vuelve a modificarse durante
 * el resto de la vida de la sesion (ni siquiera al renovar el JWT por
 * actividad en POST /api/auth/session/activity).
 */
export async function createSession(userId: string): Promise<UserSessionRecord> {
  const result = await pool.query<UserSessionRecord>(
    `INSERT INTO user_sessions (user_id, absolute_expires_at)
     VALUES ($1, NOW() + ($2 || ' hours')::interval)
     RETURNING ${SESSION_COLUMNS}`,
    [userId, env.session.absoluteTimeoutHours]
  );
  return result.rows[0];
}

/**
 * Busca una sesion por su ID (el claim "sid" del JWT).
 * Devuelve null si no existe.
 */
export async function findSessionById(sessionId: string): Promise<UserSessionRecord | null> {
  const result = await pool.query<UserSessionRecord>(
    `SELECT ${SESSION_COLUMNS} FROM user_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  return result.rows[0] ?? null;
}

/**
 * Actualiza "last_activity_at" al momento actual y devuelve la sesion
 * resultante. Solo tiene efecto sobre sesiones no revocadas.
 *
 * Se usa exclusivamente desde POST /api/auth/session/activity, que
 * representa actividad real del usuario (clic, teclado, tactil o
 * navegacion). Las peticiones de fondo (por ejemplo, el interceptor
 * agregando el header Authorization a cualquier llamada) NUNCA deben
 * llamar a esta funcion, para no enmascarar la inactividad real.
 */
export async function touchSessionActivity(
  sessionId: string
): Promise<UserSessionRecord | null> {
  const result = await pool.query<UserSessionRecord>(
    `UPDATE user_sessions
     SET last_activity_at = NOW()
     WHERE id = $1 AND is_revoked = FALSE
     RETURNING ${SESSION_COLUMNS}`,
    [sessionId]
  );
  return result.rows[0] ?? null;
}

/**
 * Revoca una sesion (cierre manual o vencimiento detectado por el
 * middleware de autenticacion). Es idempotente: revocar una sesion ya
 * revocada no produce error, simplemente no cambia nada (la clausula
 * "is_revoked = FALSE" evita pisar un "revoked_at" ya existente).
 *
 * Una sesion revocada nunca vuelve a considerarse valida: todas las
 * consultas que comprueban sesiones activas filtran por
 * "is_revoked = FALSE".
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE user_sessions
     SET is_revoked = TRUE,
         revoked_at = NOW()
     WHERE id = $1 AND is_revoked = FALSE`,
    [sessionId]
  );
}

/**
 * True si transcurrieron mas de SESSION_IDLE_TIMEOUT_MINUTES desde la
 * ultima actividad registrada en la sesion.
 */
export function isSessionIdleExpired(session: UserSessionRecord): boolean {
  const idleLimitMs = env.session.idleTimeoutMinutes * 60 * 1000;
  const elapsedMs = Date.now() - session.last_activity_at.getTime();
  return elapsedMs > idleLimitMs;
}

/**
 * True si la sesion alcanzo su duracion maxima absoluta
 * ("absolute_expires_at"), sin importar cuanta actividad haya habido.
 */
export function isSessionAbsoluteExpired(session: UserSessionRecord): boolean {
  return Date.now() > session.absolute_expires_at.getTime();
}

/**
 * Comprueba, en un unico lugar, si una sesion sigue siendo utilizable:
 * no debe estar revocada, ni vencida por inactividad, ni haber superado
 * su duracion maxima absoluta.
 */
export function isSessionUsable(session: UserSessionRecord): boolean {
  return (
    !session.is_revoked &&
    !isSessionIdleExpired(session) &&
    !isSessionAbsoluteExpired(session)
  );
}
