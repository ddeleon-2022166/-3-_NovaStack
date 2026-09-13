/**
 * Modelos exclusivos de la vista "Movimientos". No reemplazan ni
 * modifican los modelos reales "Income" y "Expense": son una forma
 * unificada, construida en el frontend (igual que en Historial), para
 * poder mostrar, filtrar y editar ambos tipos de movimiento desde una
 * sola tabla y un solo formulario.
 *
 * El id y el tipo original ("ingreso" | "egreso") se conservan siempre,
 * porque son los que determinan a cuál endpoint real (incomes o
 * expenses) hay que llamar al editar o eliminar un movimiento.
 */

export type MovementType = "ingreso" | "egreso";

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

export type MovementTypeFilter = "todos" | MovementType;

// El filtro de periodo usa el id de un periodo real (creado en la
// seccion Periodos) o "todos" para no filtrar por rango de fechas.
// No se inventa ningun campo nuevo: el backend ya calcula los totales
// de cada periodo comparando su rango de fechas contra incomes/expenses
// (ver period.model.ts), asi que aqui se aplica exactamente la misma
// logica del lado del cliente para poder filtrar el listado unificado.
export type PeriodFilterValue = "todos" | string;

export interface MovementFilters {
  periodId: PeriodFilterValue;
  type: MovementTypeFilter;
  category: string; // "todas" o una categoria real presente en los datos
  dateFrom: string; // "" o "AAAA-MM-DD"
  dateTo: string; // "" o "AAAA-MM-DD"
  search: string;
}

export const DEFAULT_MOVEMENT_FILTERS: MovementFilters = {
  periodId: "todos",
  type: "todos",
  category: "todas",
  dateFrom: "",
  dateTo: "",
  search: "",
};
