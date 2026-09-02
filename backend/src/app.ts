import express, { Application } from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./modules/auth/routes/auth.routes";
import incomesRoutes from "./modules/incomes/routes/income.routes";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";

/**
 * Configura la aplicacion Express: middlewares globales y rutas.
 * No inicia el servidor (eso ocurre en server.ts).
 */
export function createApp(): Application {
  const app = express();

  // CORS limitado unicamente al origen del frontend durante el desarrollo
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );

  app.use(express.json());

  // Ruta simple de verificacion (health check)
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Modulo de autenticacion
  app.use("/api/auth", authRoutes);

  // Modulo de ingresos (registro y consulta, asociados al usuario autenticado)
  app.use("/api/incomes", incomesRoutes);

  // Nota de arquitectura: en una proxima entrega se agregaran aqui los
  // modulos "expenses" y "bills" (por ejemplo: app.use("/api/expenses", ...)),
  // pero todavia no se implementan en esta entrega.

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
