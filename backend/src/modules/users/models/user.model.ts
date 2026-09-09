import { pool } from "../../../config/database";

// Representa la fila completa de la tabla "users", incluyendo el hash de la contrasena.
// Este tipo NUNCA debe devolverse directamente en una respuesta HTTP.
// "password_hash" es nullable porque los usuarios creados unicamente a
// traves de Google no tienen contrasena propia en NovaStack.
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  auth_provider: string;
  google_sub: string | null;
  profile_picture: string | null;
  created_at: Date;
  updated_at: Date;
}

// Datos publicos de usuario, seguros para enviar al frontend.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  profilePicture?: string | null;
}

const USER_COLUMNS =
  "id, name, email, password_hash, auth_provider, google_sub, profile_picture, created_at, updated_at";

/**
 * Busca un usuario por su correo electronico.
 * Devuelve null si no existe.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 LIMIT 1`,
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
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

/**
 * Busca un usuario por su identificador estable de Google ("sub").
 * Devuelve null si no existe ningun usuario vinculado a esa cuenta.
 */
export async function findUserByGoogleSub(googleSub: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM users WHERE google_sub = $1 LIMIT 1`,
    [googleSub]
  );
  return result.rows[0] ?? null;
}

export interface CreateGoogleUserInput {
  name: string;
  email: string;
  googleSub: string;
  profilePicture: string | null;
}

/**
 * Crea un usuario nuevo autenticado exclusivamente con Google.
 * No recibe ni guarda contrasena: "password_hash" queda en NULL.
 */
export async function createGoogleUser(input: CreateGoogleUserInput): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `INSERT INTO users (name, email, password_hash, auth_provider, google_sub, profile_picture)
     VALUES ($1, $2, NULL, 'google', $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [input.name, input.email, input.googleSub, input.profilePicture]
  );
  return result.rows[0];
}

/**
 * Vincula una cuenta de Google a un usuario tradicional ya existente
 * (mismo correo). Nunca sobrescribe "password_hash": el usuario conserva
 * la posibilidad de seguir iniciando sesion con su contrasena original.
 */
export async function linkGoogleAccountToUser(
  userId: string,
  googleSub: string,
  profilePicture: string | null
): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `UPDATE users
     SET google_sub = $2,
         profile_picture = COALESCE($3, profile_picture),
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, googleSub, profilePicture]
  );
  return result.rows[0];
}

/**
 * Convierte un registro completo de usuario en su version publica,
 * excluyendo siempre el hash de la contrasena y cualquier dato de Google
 * que no sea seguro exponer (nunca se expone "google_sub").
 */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.profile_picture ? { profilePicture: user.profile_picture } : {}),
  };
}
