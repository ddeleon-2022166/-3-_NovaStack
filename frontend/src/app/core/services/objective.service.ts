import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  CreateObjectiveRequest,
  CreateObjectiveResponse,
  ListObjectivesResponse,
  UpdateObjectiveProgressRequest,
  UpdateObjectiveProgressResponse,
  UpdateObjectiveResponse,
} from "../models/objective.models";

/**
 * Servicio de acceso a la API de objetivos. No maneja el token JWT
 * directamente: el interceptor existente (authInterceptor) ya agrega
 * "Authorization: Bearer <token>" a cada una de estas peticiones, igual
 * que hace con las de ingresos, egresos y periodos.
 */
@Injectable({ providedIn: "root" })
export class ObjectiveService {
  constructor(private readonly http: HttpClient) {}

  /** POST /api/objectives: registra un nuevo objetivo del usuario autenticado. */
  create(payload: CreateObjectiveRequest): Observable<CreateObjectiveResponse> {
    return this.http.post<CreateObjectiveResponse>(`${environment.apiUrl}/objectives`, payload);
  }

  /** GET /api/objectives: lista los objetivos del usuario autenticado, con progreso. */
  list(): Observable<ListObjectivesResponse> {
    return this.http.get<ListObjectivesResponse>(`${environment.apiUrl}/objectives`);
  }

  /** PUT /api/objectives/:id: edita un objetivo existente del usuario autenticado. */
  update(id: string, payload: CreateObjectiveRequest): Observable<UpdateObjectiveResponse> {
    return this.http.put<UpdateObjectiveResponse>(
      `${environment.apiUrl}/objectives/${id}`,
      payload
    );
  }

  /** PATCH /api/objectives/:id/progress: registra/actualiza el monto acumulado. */
  updateProgress(
    id: string,
    payload: UpdateObjectiveProgressRequest
  ): Observable<UpdateObjectiveProgressResponse> {
    return this.http.patch<UpdateObjectiveProgressResponse>(
      `${environment.apiUrl}/objectives/${id}/progress`,
      payload
    );
  }

  /** DELETE /api/objectives/:id: elimina un objetivo existente del usuario autenticado. */
  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/objectives/${id}`);
  }
}
