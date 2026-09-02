import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  CreateIncomeRequest,
  CreateIncomeResponse,
  IncomeSummaryResponse,
  ListIncomesResponse,
} from "../models/income.models";

/**
 * Servicio de acceso a la API de ingresos. No maneja el token JWT
 * directamente: el interceptor existente (authInterceptor) ya se encarga
 * de agregar "Authorization: Bearer <token>" a cada una de estas
 * peticiones, igual que hace con las de autenticacion.
 */
@Injectable({ providedIn: "root" })
export class IncomeService {
  constructor(private readonly http: HttpClient) {}

  /** POST /api/incomes: registra un nuevo ingreso del usuario autenticado. */
  create(payload: CreateIncomeRequest): Observable<CreateIncomeResponse> {
    return this.http.post<CreateIncomeResponse>(`${environment.apiUrl}/incomes`, payload);
  }

  /** GET /api/incomes: lista los ingresos del usuario autenticado. */
  list(): Observable<ListIncomesResponse> {
    return this.http.get<ListIncomesResponse>(`${environment.apiUrl}/incomes`);
  }

  /** GET /api/incomes/summary: total de ingresos del usuario autenticado. */
  summary(): Observable<IncomeSummaryResponse> {
    return this.http.get<IncomeSummaryResponse>(`${environment.apiUrl}/incomes/summary`);
  }
}
