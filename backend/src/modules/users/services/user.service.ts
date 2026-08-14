import { findUserByEmail, findUserById, PublicUser, toPublicUser } from "../models/user.model";
import { AppError } from "../../../middlewares/error.middleware";

/**
 * Obtiene los datos publicos de un usuario a partir de su ID.
 * Se utiliza en la ruta protegida GET /api/auth/me
 */
export async function getPublicUserById(userId: string): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("El usuario asociado al token ya no existe.", 401);
  }
  return toPublicUser(user);
}

export { findUserByEmail };
