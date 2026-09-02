// Categorias permitidas para un ingreso (deben coincidir exactamente con
// las que valida el backend en income.validator.ts).
export const INCOME_CATEGORIES = ["Sueldos", "Freelance", "Inversiones", "Otros"] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

// Un ingreso tal como lo devuelve el backend. "amount" llega como texto
// (el backend lo obtiene de una columna NUMERIC de PostgreSQL, que se
// serializa como string para no perder precision decimal).
export interface Income {
  id: string;
  description: string;
  amount: string;
  category: string;
  incomeDate: string;
  createdAt: string;
}

// Datos que el formulario envia al crear un ingreso.
export interface CreateIncomeRequest {
  description: string;
  amount: number;
  category: string;
  incomeDate: string;
}

export interface CreateIncomeResponse {
  message: string;
  income: Income;
}

export interface ListIncomesResponse {
  incomes: Income[];
}

export interface IncomeSummaryResponse {
  total: string;
}
