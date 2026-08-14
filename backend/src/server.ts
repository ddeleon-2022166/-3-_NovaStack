import { createApp } from "./app";
import { env } from "./config/env";
import { checkDatabaseConnection } from "./config/database";

/**
 * Punto de entrada del backend.
 * Verifica la conexion a PostgreSQL antes de aceptar solicitudes.
 */
async function bootstrap(): Promise<void> {
  try {
    await checkDatabaseConnection();

    const app = createApp();

    app.listen(env.port, () => {
      console.log(`Servidor backend escuchando en http://localhost:${env.port}`);
      console.log(`CORS habilitado para: ${env.frontendUrl}`);
    });
  } catch (error) {
    console.error("No fue posible iniciar el servidor. Revisa la conexion a PostgreSQL.");
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
