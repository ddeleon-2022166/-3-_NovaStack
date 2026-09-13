import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  CreateExpenseResponse,
  ExpenseRequest,
  ExpenseSummaryResponse,
  ListExpensesResponse,
  UpdateExpenseResponse,
} from "../models/expense.models";

/**
 * Servicio de acceso a la API de egresos. No maneja el token JWT
 * directamente: el interceptor existente (authInterceptor) ya se encarga
 * de agregar "Authorization: Bearer <token>" a cada una de estas
 * peticiones, igual que hace con las de ingresos y autenticacion.
 */
@Injectable({ providedIn: "root" })
export class ExpenseService {
  constructor(private readonly http: HttpClient) {}

  /** POST /api/expenses: registra un nuevo egreso del usuario autenticado. */
  create(payload: ExpenseRequest): Observable<CreateExpenseResponse> {
    return this.http.post<CreateExpenseResponse>(`${environment.apiUrl}/expenses`, payload);
  }

  /** GET /api/expenses: lista los egresos del usuario autenticado. */
  list(): Observable<ListExpensesResponse> {
    return this.http.get<ListExpensesResponse>(`${environment.apiUrl}/expenses`);
  }

  /** GET /api/expenses/summary: total de egresos del usuario autenticado. */
  summary(): Observable<ExpenseSummaryResponse> {
    return this.http.get<ExpenseSummaryResponse>(`${environment.apiUrl}/expenses/summary`);
  }

  /** PUT /api/expenses/:id: edita un egreso existente del usuario autenticado. */
  update(id: string, payload: ExpenseRequest): Observable<UpdateExpenseResponse> {
    return this.http.put<UpdateExpenseResponse>(`${environment.apiUrl}/expenses/${id}`, payload);
  }

  /** DELETE /api/expenses/:id: elimina un egreso existente del usuario autenticado. */
  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/expenses/${id}`);
  }
}
