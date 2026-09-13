import express, { Application } from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./modules/auth/routes/auth.routes";
import incomesRoutes from "./modules/incomes/routes/income.routes";
import expensesRoutes from "./modules/expenses/routes/expense.routes";
import periodsRoutes from "./modules/periods/routes/period.routes";
import objectivesRoutes from "./modules/objectives/routes/objective.routes";
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

  // Modulo de egresos (registro, consulta, edicion y eliminacion, asociados al usuario autenticado)
  app.use("/api/expenses", expensesRoutes);

  // Modulo de periodos (registro, consulta, edicion, activacion y eliminacion,
  // asociados al usuario autenticado; totales calculados por rango de fechas
  // contra "incomes" y "expenses")
  app.use("/api/periods", periodsRoutes);

  // Modulo de objetivos (registro, consulta, edicion, actualizacion de
  // progreso y eliminacion, asociados al usuario autenticado; cada
  // objetivo se relaciona con un periodo real via period_id)
  app.use("/api/objectives", objectivesRoutes);

  // Nota de arquitectura: en una proxima entrega se agregara aqui el
  // modulo "bills" (cuentas a pagar), pero todavia no se implementa en
  // esta entrega.

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
