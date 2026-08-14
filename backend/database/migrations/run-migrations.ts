import fs from "fs";
import path from "path";
import { pool } from "../../src/config/database";

/**
 * Ejecuta, en orden alfabetico, todos los archivos .sql de esta carpeta.
 * Pensado para un proyecto academico: simple y directo, sin control de
 * versiones de migraciones (no vuelve a aplicar nada automaticamente,
 * pero las sentencias usan IF NOT EXISTS, por lo que es seguro re-ejecutarlo).
 */
async function runMigrations(): Promise<void> {
  const migrationsDir = __dirname;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No se encontraron archivos .sql en database/migrations.");
    return;
  }

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    console.log(`Ejecutando migracion: ${file}`);
    await pool.query(sql);
    console.log(`Migracion aplicada correctamente: ${file}`);
  }

  await pool.end();
  console.log("Todas las migraciones se ejecutaron correctamente.");
}

runMigrations().catch((error) => {
  console.error("Error al ejecutar las migraciones:");
  console.error(error);
  process.exit(1);
});
