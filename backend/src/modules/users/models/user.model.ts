import { pool } from "../../../config/database";

// Representa la fila completa de la tabla "users", incluyendo el hash de la contrasena.
// Este tipo NUNCA debe devolverse directamente en una respuesta HTTP.
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

// Datos publicos de usuario, seguros para enviar al frontend.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Busca un usuario por su correo electronico.
 * Devuelve null si no existe.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  return result.rows[0] ?? null;
}

/**
 * Busca un usuario por su ID.
 * Devuelve null si no existe.
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] ?? null;
}

/**
 * Convierte un registro completo de usuario en su version publica,
 * excluyendo siempre el hash de la contrasena.
 */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}
