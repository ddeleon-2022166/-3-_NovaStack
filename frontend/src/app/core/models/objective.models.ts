// Estados posibles de un objetivo (deben coincidir exactamente con los
// que calcula el backend en objective.service.ts). El backend siempre
// recalcula el estado a partir del progreso real: el frontend nunca lo
// envia al crear/editar, solo lo muestra.
export const OBJECTIVE_STATUSES = ["no_iniciado", "en_progreso", "cumplido"] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

// Tipos/categorias permitidos para un objetivo (deben coincidir
// exactamente con ALLOWED_OBJECTIVE_CATEGORIES en objective.validator.ts).
export const OBJECTIVE_CATEGORIES = [
  "Ahorro",
  "Educacion",
  "Compra",
  "Inversion",
  "Otros",
] as const;
export type ObjectiveCategory = (typeof OBJECTIVE_CATEGORIES)[number];

// Un objetivo tal como lo devuelve el backend. Los montos llegan como
// texto (columnas NUMERIC de PostgreSQL) y "progressPercentage" ya viene
// calculado desde el servidor (0-100, sin decimales).
export interface Objective {
  id: string;
  periodId: string;
  periodName: string;
  name: string;
  description: string;
  category: ObjectiveCategory;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  status: ObjectiveStatus;
  progressPercentage: number;
  createdAt: string;
}

// Datos que el formulario envia al crear o editar un objetivo. No incluye
// "status": el backend lo recalcula siempre a partir de los montos.
export interface CreateObjectiveRequest {
  periodId: string;
  name: string;
  description: string;
  category: ObjectiveCategory;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
}

export interface UpdateObjectiveProgressRequest {
  currentAmount: number;
}

export interface CreateObjectiveResponse {
  message: string;
  objective: Objective;
}

export interface UpdateObjectiveResponse {
  message: string;
  objective: Objective;
}

export interface UpdateObjectiveProgressResponse {
  message: string;
  objective: Objective;
}

export interface ListObjectivesResponse {
  objectives: Objective[];
}
