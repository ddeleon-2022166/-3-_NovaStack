import { Injectable, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthUser, LoginCredentials, LoginResponse, MeResponse } from "../models/auth.models";

// Clave usada en localStorage para guardar el JWT.
// Estrategia sencilla y suficiente para el alcance academico de esta entrega.
const TOKEN_KEY = "control_de_gastos_token";

@Injectable({ providedIn: "root" })
export class AuthService {
  // Signal reactiva con el usuario autenticado actual (null si no hay sesion)
  readonly currentUser = signal<AuthUser | null>(null);

  constructor(private readonly http: HttpClient) {}

  /**
   * Envia las credenciales al backend. Si son correctas, guarda el token
   * y actualiza el usuario en memoria.
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          this.saveToken(response.token);
          this.currentUser.set(response.user);
        })
      );
  }

  /**
   * Consulta la ruta protegida /api/auth/me para confirmar que el token
   * sigue siendo valido y obtener los datos del usuario autenticado.
   */
  fetchCurrentUser(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(
      tap((response) => this.currentUser.set(response.user))
    );
  }

  /** Elimina el token y limpia el usuario en memoria. */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
  }

  /** Guarda el token JWT en localStorage. */
  saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /** Obtiene el token JWT almacenado, o null si no existe. */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Indica si existe un token guardado (no garantiza que siga siendo valido). */
  hasToken(): boolean {
    return !!this.getToken();
  }
}
