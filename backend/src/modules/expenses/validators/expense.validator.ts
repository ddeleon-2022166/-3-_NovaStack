import { AppError } from "../../../middlewares/error.middleware";

export interface ExpenseInput {
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
}

// Categorias permitidas para un egreso, tal como aparecen en la maqueta.
export const ALLOWED_EXPENSE_CATEGORIES = [
  "Comida",
  "Servicios",
  "Viajes",
  "Entretenimiento",
  "Salud",
  "Otros",
] as const;

export type ExpenseCategory = (typeof ALLOWED_EXPENSE_CATEGORIES)[number];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION_LENGTH = 255;

// La columna "amount" es NUMERIC(12, 2): 12 digitos en total, 2 de ellos
// decimales, es decir, hasta 10 digitos enteros. El maximo valor que
// PostgreSQL puede almacenar en esa columna es 9999999999.99.
const MAX_AMOUNT = 9999999999.99;
// Maximo de 2 decimales, sin importar cuantos digitos enteros tenga.
const AMOUNT_DECIMALS_REGEX = /^-?\d+(\.\d{1,2})?$/;

function isAllowedCategory(value: string): value is ExpenseCategory {
  return (ALLOWED_EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Fecha actual del servidor en formato "AAAA-MM-DD", usando la hora
 * local (no UTC) para que coincida con como el frontend arma
 * expenseDate a partir de un Date local. Sirve para impedir registrar
 * egresos con fecha futura.
 */
function todayLocalIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Valida el cuerpo de la solicitud para crear o editar un egreso. Se
 * reutiliza para ambos casos porque los campos y las reglas son
 * exactamente los mismos.
 */
export function validateExpenseInput(body: unknown): ExpenseInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Debes enviar los datos del egreso.", 400);
  }

  const { description, amount, category, expenseDate } = body as Record<string, unknown>;

  if (typeof description !== "string" || description.trim().length === 0) {
    throw new AppError("La descripcion es obligatoria.", 400);
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError(
      `La descripcion no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      400
    );
  }

  if (amount === null || amount === undefined || amount === "") {
    throw new AppError("El monto es obligatorio.", 400);
  }

  if (typeof amount !== "number" && typeof amount !== "string") {
    throw new AppError("Ingrese un monto válido.", 400);
  }

  const numericAmount = typeof amount === "number" ? amount : Number(amount);

  if (Number.isNaN(numericAmount) || !Number.isFinite(numericAmount)) {
    throw new AppError("Ingrese un monto válido.", 400);
  }

  if (numericAmount <= 0) {
    throw new AppError("El monto debe ser mayor que cero.", 400);
  }

  // Se valida el numero de decimales sobre la representacion textual
  // original: convertir a numero antes puede perder la forma exacta que
  // envio el cliente (por ejemplo, "10.999").
  if (!AMOUNT_DECIMALS_REGEX.test(String(amount).trim())) {
    throw new AppError("El monto solo puede tener dos decimales.", 400);
  }

  if (numericAmount > MAX_AMOUNT) {
    throw new AppError("El monto supera el valor máximo permitido.", 400);
  }

  if (typeof category !== "string" || !isAllowedCategory(category)) {
    throw new AppError(
      `La categoria debe ser una de las siguientes: ${ALLOWED_EXPENSE_CATEGORIES.join(", ")}.`,
      400
    );
  }

  if (typeof expenseDate !== "string" || !DATE_REGEX.test(expenseDate)) {
    throw new AppError("La fecha es obligatoria y debe tener el formato AAAA-MM-DD.", 400);
  }

  const parsedDate = new Date(`${expenseDate}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError("La fecha no es valida.", 400);
  }

  if (expenseDate > todayLocalIsoDate()) {
    throw new AppError("La fecha no puede ser posterior al día de hoy.", 400);
  }

  return {
    description: trimmedDescription,
    amount: Math.round(numericAmount * 100) / 100,
    category,
    expenseDate,
  };
}

/** Valida que el parametro ":id" de la ruta tenga forma de UUID. */
export function validateExpenseId(id: unknown): string {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw new AppError("El identificador del egreso no es valido.", 400);
  }
  return id;
}
