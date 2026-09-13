import { AppError } from "../../../middlewares/error.middleware";

export const ALLOWED_PERIOD_STATUSES = ["activo", "cerrado", "planificado"] as const;
export type PeriodStatus = (typeof ALLOWED_PERIOD_STATUSES)[number];

export interface CreatePeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;

function isAllowedStatus(value: string): value is PeriodStatus {
  return (ALLOWED_PERIOD_STATUSES as readonly string[]).includes(value);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

/**
 * Valida el cuerpo de la solicitud para crear o editar un periodo.
 * Lanza un AppError con codigo 400 si algun dato es invalido, incluida
 * la regla "la fecha final no puede ser anterior a la inicial".
 */
export function validateCreatePeriodInput(body: unknown): CreatePeriodInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Debes enviar los datos del periodo.", 400);
  }

  const { name, startDate, endDate, status } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new AppError("El nombre del periodo es obligatorio.", 400);
  }

  const trimmedName = name.trim();

  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new AppError("El nombre del periodo es demasiado largo.", 400);
  }

  if (!isValidIsoDate(startDate)) {
    throw new AppError("La fecha de inicio es obligatoria y debe tener el formato AAAA-MM-DD.", 400);
  }

  if (!isValidIsoDate(endDate)) {
    throw new AppError("La fecha de finalizacion es obligatoria y debe tener el formato AAAA-MM-DD.", 400);
  }

  if (endDate < startDate) {
    throw new AppError("La fecha de finalizacion no puede ser anterior a la fecha de inicio.", 400);
  }

  const statusValue = typeof status === "string" ? status : "planificado";

  if (!isAllowedStatus(statusValue)) {
    throw new AppError(
      `El estado debe ser uno de los siguientes: ${ALLOWED_PERIOD_STATUSES.join(", ")}.`,
      400
    );
  }

  return {
    name: trimmedName,
    startDate,
    endDate,
    status: statusValue,
  };
}

/** Valida que el parametro ":id" de la ruta tenga forma de UUID. */
export function validatePeriodId(id: unknown): string {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw new AppError("El identificador del periodo no es valido.", 400);
  }
  return id;
}
