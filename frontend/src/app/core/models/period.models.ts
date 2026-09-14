// Estados permitidos para un periodo (deben coincidir exactamente con
// los que valida el backend en period.validator.ts).
export const PERIOD_STATUSES = ["activo", "cerrado", "planificado"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

// Un periodo tal como lo devuelve el backend. Los montos llegan como
// texto (columnas NUMERIC de PostgreSQL, serializadas como string para
// no perder precision decimal).
export interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  createdAt: string;
}

// Datos que el formulario envia al crear o editar un periodo.
export interface CreatePeriodRequest {
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
}

export interface CreatePeriodResponse {
  message: string;
  period: Period;
}

export interface UpdatePeriodResponse {
  message: string;
  period: Period;
}

export interface ActivatePeriodResponse {
  message: string;
  period: Period;
}

export interface ListPeriodsResponse {
  periods: Period[];
}
