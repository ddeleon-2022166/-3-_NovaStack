import { Pool, types } from "pg";
import { env } from "./env";

// node-postgres, por defecto, convierte las columnas DATE (oid 1082) en
// objetos Date de JavaScript construidos en la hora local del proceso.
// Al serializarse a JSON (res.json) ese Date se transforma en un ISO
// string completo con hora y zona ("2026-09-13T06:00:00.000Z"), lo que
// corrompe cualquier codigo que espere el formato "AAAA-MM-DD" (como ya
// asumen los modelos de incomes, expenses y periods) y puede desplazar
// el dia segun la zona horaria. Se desactiva esa conversion para que
// PostgreSQL entregue las columnas DATE tal cual, como texto.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

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
