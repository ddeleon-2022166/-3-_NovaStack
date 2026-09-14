import { AppError } from "../../../middlewares/error.middleware";

// Categorias permitidas para un objetivo. Se mantienen en espaniol, sin
// tildes, igual que ALLOWED_EXPENSE_CATEGORIES en el modulo de egresos.
export const ALLOWED_OBJECTIVE_CATEGORIES = [
  "Ahorro",
  "Educacion",
  "Compra",
  "Inversion",
  "Otros",
] as const;

export type ObjectiveCategory = (typeof ALLOWED_OBJECTIVE_CATEGORIES)[number];

export interface ObjectiveInput {
  periodId: string;
  name: string;
  description: string;
  category: ObjectiveCategory;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
}

export interface ObjectiveProgressInput {
  currentAmount: number;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 255;

function isAllowedCategory(value: string): value is ObjectiveCategory {
  return (ALLOWED_OBJECTIVE_CATEGORIES as readonly string[]).includes(value);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

/**
 * Valida el cuerpo de la solicitud para crear o editar un objetivo.
 * "currentAmount" es opcional (por defecto 0, un objetivo puede crearse
 * sin ahorro inicial) y nunca puede ser mayor que "targetAmount": si el
 * usuario ya alcanzo o supero la meta, el objetivo se considera cumplido,
 * no "sobre-cumplido".
 */
export function validateObjectiveInput(body: unknown): ObjectiveInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Debes enviar los datos del objetivo.", 400);
  }

  const { periodId, name, description, category, targetAmount, currentAmount, deadline } =
    body as Record<string, unknown>;

  if (typeof periodId !== "string" || !UUID_REGEX.test(periodId)) {
    throw new AppError("Debes seleccionar un periodo valido.", 400);
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new AppError("El nombre del objetivo es obligatorio.", 400);
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new AppError("El nombre del objetivo es demasiado largo.", 400);
  }

  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError("La descripcion es demasiado larga.", 400);
  }

  if (typeof category !== "string" || !isAllowedCategory(category)) {
    throw new AppError(
      `El tipo de objetivo debe ser uno de los siguientes: ${ALLOWED_OBJECTIVE_CATEGORIES.join(", ")}.`,
      400
    );
  }

  if (targetAmount === null || targetAmount === undefined || targetAmount === "") {
    throw new AppError("El monto de la meta es obligatorio.", 400);
  }

  const numericTarget = typeof targetAmount === "number" ? targetAmount : Number(targetAmount);
  if (Number.isNaN(numericTarget) || !Number.isFinite(numericTarget) || numericTarget <= 0) {
    throw new AppError("El monto de la meta debe ser un numero mayor que cero.", 400);
  }

  let numericCurrent = 0;
  if (currentAmount !== null && currentAmount !== undefined && currentAmount !== "") {
    numericCurrent = typeof currentAmount === "number" ? currentAmount : Number(currentAmount);
    if (Number.isNaN(numericCurrent) || !Number.isFinite(numericCurrent) || numericCurrent < 0) {
      throw new AppError("El monto actual debe ser un numero mayor o igual que cero.", 400);
    }
  }

  let normalizedDeadline: string | null = null;
  if (deadline !== null && deadline !== undefined && deadline !== "") {
    if (!isValidIsoDate(deadline)) {
      throw new AppError("La fecha limite debe tener el formato AAAA-MM-DD.", 400);
    }
    normalizedDeadline = deadline;
  }

  return {
    periodId,
    name: trimmedName,
    description: trimmedDescription,
    category,
    targetAmount: Math.round(numericTarget * 100) / 100,
    currentAmount: Math.round(Math.min(numericCurrent, numericTarget) * 100) / 100,
    deadline: normalizedDeadline,
  };
}

/** Valida el cuerpo de la solicitud para actualizar unicamente el progreso. */
export function validateObjectiveProgressInput(body: unknown): ObjectiveProgressInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Debes enviar el monto actual del objetivo.", 400);
  }

  const { currentAmount } = body as Record<string, unknown>;

  if (currentAmount === null || currentAmount === undefined || currentAmount === "") {
    throw new AppError("El monto actual es obligatorio.", 400);
  }

  const numericCurrent = typeof currentAmount === "number" ? currentAmount : Number(currentAmount);
  if (Number.isNaN(numericCurrent) || !Number.isFinite(numericCurrent) || numericCurrent < 0) {
    throw new AppError("El monto actual debe ser un numero mayor o igual que cero.", 400);
  }

  return { currentAmount: Math.round(numericCurrent * 100) / 100 };
}

/** Valida que el parametro ":id" de la ruta tenga forma de UUID. */
export function validateObjectiveId(id: unknown): string {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw new AppError("El identificador del objetivo no es valido.", 400);
  }
  return id;
}
