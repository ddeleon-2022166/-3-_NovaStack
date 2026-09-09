import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../../config/env";
import { AppError } from "../../../middlewares/error.middleware";
import {
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  linkGoogleAccountToUser,
  PublicUser,
  toPublicUser,
  UserRecord,
} from "../../users/models/user.model";
import {
  createSession,
  isSessionAbsoluteExpired,
  revokeSession,
  touchSessionActivity,
} from "../models/session.model";
import { GoogleAuthInput, LoginInput } from "../validators/auth.validator";

export interface LoginResult {
  token: string;
  user: PublicUser;
}

// Mensaje generico: nunca se debe indicar si el correo existe o no.
const INVALID_CREDENTIALS_MESSAGE = "El correo o la contrasena son incorrectos.";

// Cliente reutilizable de Google. La libreria acepta el "audience"
// (GOOGLE_CLIENT_ID) en cada llamada a verifyIdToken, por lo que no es
// necesario pasarlo al construir el cliente.
const googleClient = new OAuth2Client();

/**
 * Firma un JWT interno de NovaStack. Siempre incluye "sid" (el ID de la
 * sesion en PostgreSQL), que es lo que permite al backend comprobar
 * inactividad, revocacion y duracion maxima absoluta en cada peticion
 * protegida.
 */
function issueToken(user: UserRecord, sessionId: string): string {
  return jwt.sign({ userId: user.id, sid: sessionId }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as jwt.SignOptions);
}

/**
 * Ejecuta el flujo completo de inicio de sesion tradicional:
 * 1. Busca al usuario por correo en PostgreSQL.
 * 2. Compara la contrasena ingresada contra el hash almacenado.
 * 3. Genera un JWT si las credenciales son correctas.
 */
export async function login({ email, password }: LoginInput): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  // "user.password_hash" puede ser NULL en cuentas creadas exclusivamente
  // con Google: en ese caso tampoco existe una contrasena valida contra la
  // cual comparar, y se responde el mismo mensaje generico de siempre.
  if (!user || !user.password_hash) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  // Cada inicio de sesion crea una sesion nueva en PostgreSQL; nunca se
  // reutiliza una existente.
  const session = await createSession(user.id);

  return {
    token: issueToken(user, session.id),
    user: toPublicUser(user),
  };
}

/**
 * Ejecuta el flujo de inicio de sesion con Google:
 * 1. Verifica el ID token con la biblioteca oficial de Google (firma,
 *    audiencia, emisor y expiracion se validan dentro de verifyIdToken).
 * 2. Exige que el correo de la cuenta de Google este verificado.
 * 3. Busca al usuario por "google_sub"; si no existe, busca por correo
 *    para vincular una cuenta tradicional existente sin duplicarla ni
 *    sobrescribir su contrasena; si tampoco existe por correo, crea un
 *    usuario nuevo.
 * 4. Emite el mismo JWT interno de NovaStack que usa el login tradicional.
 */
export async function loginWithGoogle({ idToken }: GoogleAuthInput): Promise<LoginResult> {
  if (!env.google.clientId) {
    throw new AppError(
      "El inicio de sesion con Google no esta configurado en el servidor.",
      500
    );
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError("El token de Google no es valido.", 401);
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new AppError("El token de Google no es valido.", 401);
  }

  if (!payload.email_verified) {
    throw new AppError("El correo de la cuenta de Google no esta verificado.", 401);
  }

  const googleSub = payload.sub;
  const normalizedEmail = payload.email.toLowerCase();
  const name = payload.name?.trim() || normalizedEmail;
  const profilePicture = payload.picture ?? null;

  let user = await findUserByGoogleSub(googleSub);

  if (!user) {
    const existingByEmail = await findUserByEmail(normalizedEmail);

    if (existingByEmail) {
      // Vinculacion segura: el correo ya existia (login tradicional).
      // Se conserva la contrasena y solo se agrega el google_sub.
      user = await linkGoogleAccountToUser(existingByEmail.id, googleSub, profilePicture);
    } else {
      user = await createGoogleUser({
        name,
        email: normalizedEmail,
        googleSub,
        profilePicture,
      });
    }
  }

  // Igual que en el login tradicional: cada inicio de sesion con Google
  // crea su propia sesion en PostgreSQL, con el mismo control de
  // inactividad y duracion maxima absoluta.
  const session = await createSession(user.id);

  return {
    token: issueToken(user, session.id),
    user: toPublicUser(user),
  };
}

/**
 * Renueva la actividad de una sesion existente (endpoint
 * POST /api/auth/session/activity). Se ejecuta siempre despues de
 * authMiddleware, que ya comprobo que la sesion sigue activa, no
 * revocada, no vencida por inactividad y dentro de su duracion maxima
 * absoluta; por eso aqui no se recupera una sesion ya vencida, solo se
 * confirma actividad sobre una sesion que ya se sabe valida.
 *
 * Emite un JWT nuevo con otros SESSION_IDLE_TIMEOUT_MINUTES de duracion,
 * conservando el mismo "sid". Nunca modifica "absolute_expires_at".
 */
export async function refreshSessionActivity(
  userId: string,
  sessionId: string
): Promise<string> {
  const session = await touchSessionActivity(sessionId);

  if (!session) {
    // Defensivo: la sesion se revoco entre el middleware y este punto.
    throw new AppError("La sesion ha expirado por inactividad.", 401, "SESSION_EXPIRED");
  }

  if (isSessionAbsoluteExpired(session)) {
    await revokeSession(sessionId);
    throw new AppError(
      "La sesion alcanzo su duracion maxima permitida.",
      401,
      "SESSION_EXPIRED"
    );
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("El usuario asociado al token ya no existe.", 401);
  }

  return issueToken(user, sessionId);
}

/**
 * Revoca en PostgreSQL la sesion indicada (cierre manual de sesion,
 * endpoint POST /api/auth/logout). Una sesion revocada no puede volver a
 * utilizarse.
 */
export async function logoutSession(sessionId: string): Promise<void> {
  await revokeSession(sessionId);
}
