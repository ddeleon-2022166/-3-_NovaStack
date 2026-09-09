import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../../config/env";
import { AppError } from "../../../middlewares/error.middleware";
import {
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleSub,
  linkGoogleAccountToUser,
  PublicUser,
  toPublicUser,
  UserRecord,
} from "../../users/models/user.model";
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

function issueToken(user: UserRecord): string {
  return jwt.sign({ userId: user.id }, env.jwt.secret, {
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

  return {
    token: issueToken(user),
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

  return {
    token: issueToken(user),
    user: toPublicUser(user),
  };
}
