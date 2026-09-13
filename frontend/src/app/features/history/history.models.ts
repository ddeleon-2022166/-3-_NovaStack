/**
 * Modelos exclusivos de la vista de Historial. No reemplazan ni
 * modifican los modelos reales "Income" y "Expense": son solo una forma
 * unificada, construida en el frontend, para poder combinar ambos tipos
 * de movimiento en una sola tabla, con filtros y paginacion.
 */

export type MovementType = "ingreso" | "egreso";

// Un movimiento normalizado (ingreso o egreso), tal como se muestra en
// Historial. Conserva el id y el tipo original para poder distinguir de
// que endpoint vino cada registro.
export interface Movement {
  id: string;
  type: MovementType;
  description: string;
  category: string;
  amount: number;
  /** Fecha del movimiento en formato AAAA-MM-DD (income_date / expense_date). */
  date: string;
  /** Fecha y hora en que el registro se creo en el sistema (created_at). */
  createdAt: string;
}

// Preajustes de periodo para el filtro "Periodo". No corresponden a una
// entidad real de "periodos" en la base de datos (el proyecto todavia no
// tiene ese modulo): son rangos de fecha calculados en el frontend.
export type PeriodPreset = "todos" | "ultimo_mes" | "ultimos_7" | "este_mes";

export type MovementTypeFilter = "todos" | MovementType;

export interface HistoryFilters {
  period: PeriodPreset;
  type: MovementTypeFilter;
  category: string; // "todas" o una categoria real presente en los datos
  dateFrom: string; // "" o "AAAA-MM-DD"
  dateTo: string; // "" o "AAAA-MM-DD"
  search: string;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  period: "todos",
  type: "todos",
  category: "todas",
  dateFrom: "",
  dateTo: "",
  search: "",
};
