// Categorias permitidas para un egreso (deben coincidir exactamente con
// las que valida el backend en expense.validator.ts).
export const EXPENSE_CATEGORIES = [
  "Comida",
  "Servicios",
  "Viajes",
  "Entretenimiento",
  "Salud",
  "Otros",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Un egreso tal como lo devuelve el backend. "amount" llega como texto
// (columna NUMERIC de PostgreSQL, serializada como string para no perder
// precision decimal).
export interface Expense {
  id: string;
  description: string;
  amount: string;
  category: string;
  expenseDate: string;
  createdAt: string;
}

// Datos que el formulario envia al crear o editar un egreso.
export interface ExpenseRequest {
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
}

export interface CreateExpenseResponse {
  message: string;
  expense: Expense;
}

export interface UpdateExpenseResponse {
  message: string;
  expense: Expense;
}

export interface ListExpensesResponse {
  expenses: Expense[];
}

export interface ExpenseSummaryResponse {
  total: string;
}
