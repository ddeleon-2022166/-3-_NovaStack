import { AppError } from "../../../middlewares/error.middleware";

export interface CreateIncomeInput {
  description: string;
  amount: number;
  category: string;
  incomeDate: string;
}

// Categorias permitidas para un ingreso. Se valida contra esta lista
// cerrada en vez de aceptar cualquier texto, para mantener datos
// consistentes en los reportes futuros.
export const ALLOWED_INCOME_CATEGORIES = ["Sueldos", "Freelance", "Inversiones", "Otros"] as const;

export type IncomeCategory = (typeof ALLOWED_INCOME_CATEGORIES)[number];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DESCRIPTION_LENGTH = 255;

function isAllowedCategory(value: string): value is IncomeCategory {
  return (ALLOWED_INCOME_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Valida el cuerpo de la solicitud para registrar un nuevo ingreso.
 * Lanza un AppError con codigo 400 si algun dato es invalido.
 */
export function validateCreateIncomeInput(body: unknown): CreateIncomeInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Debes enviar los datos del ingreso.", 400);
  }

  const { description, amount, category, incomeDate } = body as Record<string, unknown>;

  if (typeof description !== "string" || description.trim().length === 0) {
    throw new AppError("La descripcion es obligatoria.", 400);
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError("La descripcion es demasiado larga.", 400);
  }

  if (amount === null || amount === undefined || amount === "") {
    throw new AppError("El monto es obligatorio.", 400);
  }

  const numericAmount = typeof amount === "number" ? amount : Number(amount);

  if (Number.isNaN(numericAmount) || !Number.isFinite(numericAmount)) {
    throw new AppError("El monto debe ser un numero valido.", 400);
  }

  if (numericAmount <= 0) {
    throw new AppError("El monto debe ser mayor que cero.", 400);
  }

  if (typeof category !== "string" || !isAllowedCategory(category)) {
    throw new AppError(
      `La categoria debe ser una de las siguientes: ${ALLOWED_INCOME_CATEGORIES.join(", ")}.`,
      400
    );
  }

  if (typeof incomeDate !== "string" || !DATE_REGEX.test(incomeDate)) {
    throw new AppError("La fecha es obligatoria y debe tener el formato AAAA-MM-DD.", 400);
  }

  const parsedDate = new Date(`${incomeDate}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError("La fecha no es valida.", 400);
  }

  return {
    description: trimmedDescription,
    // Redondea a 2 decimales para que coincida con NUMERIC(12,2) en la base de datos
    amount: Math.round(numericAmount * 100) / 100,
    category,
    incomeDate,
  };
}
