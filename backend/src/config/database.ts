import { Pool } from "pg";
import { env } from "./env";

// Pool de conexiones reutilizable hacia PostgreSQL
export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
});

/**
 * Verifica que la conexion a PostgreSQL funcione correctamente.
 * Se utiliza al iniciar el servidor para fallar rapido si la base de datos
 * no esta disponible.
 */
export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log(`Conexion a PostgreSQL exitosa (base de datos: ${env.db.name})`);
  } finally {
    client.release();
  }
}
