import { AppError } from "../../../middlewares/error.middleware";

export interface LoginInput {
  email: string;
  password: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida el cuerpo de la solicitud de login.
 * Lanza un AppError con codigo 400 si los datos son invalidos.
 */
export function validateLoginInput(body: unknown): LoginInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Debes enviar el correo y la contrasena.", 400);
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || email.trim().length === 0) {
    throw new AppError("El correo electronico es obligatorio.", 400);
  }

  if (typeof password !== "string" || password.length === 0) {
    throw new AppError("La contrasena es obligatoria.", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new AppError("El formato del correo electronico no es valido.", 400);
  }

  return { email: normalizedEmail, password };
}
