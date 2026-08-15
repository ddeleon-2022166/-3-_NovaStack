import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import { AppError } from "../../../middlewares/error.middleware";
import { findUserByEmail, PublicUser, toPublicUser } from "../../users/models/user.model";
import { LoginInput } from "../validators/auth.validator";

export interface LoginResult {
  token: string;
  user: PublicUser;
}

// Mensaje generico: nunca se debe indicar si el correo existe o no.
const INVALID_CREDENTIALS_MESSAGE = "El correo o la contrasena son incorrectos.";

/**
 * Ejecuta el flujo completo de inicio de sesion:
 * 1. Busca al usuario por correo en PostgreSQL.
 * 2. Compara la contrasena ingresada contra el hash almacenado.
 * 3. Genera un JWT si las credenciales son correctas.
 */
export async function login({ email, password }: LoginInput): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const token = jwt.sign({ userId: user.id }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as jwt.SignOptions);

  return {
    token,
    user: toPublicUser(user),
  };
}
