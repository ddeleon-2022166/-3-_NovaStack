import bcrypt from "bcryptjs";
import { pool } from "../../src/config/database";

// Credenciales academicas del usuario inicial (cliente de la aplicacion).
// La contrasena en texto plano SOLO existe aqui, para poder crear el hash,
// y se documenta en las instrucciones de ejecucion para poder probar el login.
// Nunca se guarda en texto plano en la base de datos.
const SEED_USER = {
  name: "Cliente Control de Gastos",
  email: "cliente@controldegastos.com",
  plainPassword: "Cliente2026*",
};

/**
 * Crea el usuario inicial de prueba si todavia no existe.
 * Es seguro ejecutar este script varias veces: no genera duplicados.
 */
async function seed(): Promise<void> {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [
    SEED_USER.email,
  ]);

  if ((existing.rowCount ?? 0) > 0) {
    console.log(`El usuario "${SEED_USER.email}" ya existe. No se crearon duplicados.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_USER.plainPassword, 10);

  await pool.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
    [SEED_USER.name, SEED_USER.email, passwordHash]
  );

  console.log("Usuario inicial creado correctamente:");
  console.log(`  Correo: ${SEED_USER.email}`);
  console.log(`  Contrasena (solo para pruebas): ${SEED_USER.plainPassword}`);

  await pool.end();
}

seed().catch((error) => {
  console.error("Error al ejecutar el seed:");
  console.error(error);
  process.exit(1);
});
