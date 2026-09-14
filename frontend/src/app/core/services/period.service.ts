import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  ActivatePeriodResponse,
  CreatePeriodRequest,
  CreatePeriodResponse,
  ListPeriodsResponse,
  UpdatePeriodResponse,
} from "../models/period.models";

/**
 * Servicio de acceso a la API de periodos. No maneja el token JWT
 * directamente: el interceptor existente (authInterceptor) ya agrega
 * "Authorization: Bearer <token>" a cada una de estas peticiones, igual
 * que hace con las de ingresos y egresos.
 */
@Injectable({ providedIn: "root" })
export class PeriodService {
  constructor(private readonly http: HttpClient) {}

  /** POST /api/periods: registra un nuevo periodo del usuario autenticado. */
  create(payload: CreatePeriodRequest): Observable<CreatePeriodResponse> {
    return this.http.post<CreatePeriodResponse>(`${environment.apiUrl}/periods`, payload);
  }

  /** GET /api/periods: lista los periodos del usuario autenticado, con totales. */
  list(): Observable<ListPeriodsResponse> {
    return this.http.get<ListPeriodsResponse>(`${environment.apiUrl}/periods`);
  }

  /** PUT /api/periods/:id: edita un periodo existente del usuario autenticado. */
  update(id: string, payload: CreatePeriodRequest): Observable<UpdatePeriodResponse> {
    return this.http.put<UpdatePeriodResponse>(`${environment.apiUrl}/periods/${id}`, payload);
  }

  /** PATCH /api/periods/:id/activate: establece un periodo como activo. */
  activate(id: string): Observable<ActivatePeriodResponse> {
    return this.http.patch<ActivatePeriodResponse>(
      `${environment.apiUrl}/periods/${id}/activate`,
      {}
    );
  }

  /** DELETE /api/periods/:id: elimina un periodo existente del usuario autenticado. */
  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/periods/${id}`);
  }
}
