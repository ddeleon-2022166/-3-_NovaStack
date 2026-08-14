import { NextFunction, Request, Response } from "express";

// Error personalizado que permite adjuntar un codigo HTTP especifico
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Middleware centralizado de manejo de errores.
 * Debe registrarse siempre al final, despues de todas las rutas.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // Nunca se exponen detalles internos ni trazas al cliente
  console.error("Error no controlado:", err);
  res.status(500).json({ message: "Ocurrio un error interno en el servidor." });
}

/**
 * Middleware para capturar rutas no existentes (404)
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}
