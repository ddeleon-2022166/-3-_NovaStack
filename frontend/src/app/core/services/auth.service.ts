import { Injectable, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  AuthUser,
  GoogleLoginResponse,
  LoginCredentials,
  LoginResponse,
  MeResponse,
} from "../models/auth.models";

// Clave usada en localStorage para guardar el JWT.
// Estrategia sencilla y suficiente para el alcance academico de esta entrega.
const TOKEN_KEY = "control_de_gastos_token";

// Forma minima del payload de un JWT que nos interesa leer en el frontend.
// "exp" es un campo estandar de JWT: fecha de expiracion en segundos Unix.
interface DecodedJwtPayload {
  exp?: number;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  // Signal reactiva con el usuario autenticado actual (null si no hay sesion)
  readonly currentUser = signal<AuthUser | null>(null);

  // Signal reactiva que se activa cuando el token expira (o deja de ser
  // valido). Cualquier componente puede leerla para mostrar un aviso,
  // sin necesidad de que ese componente haga la llamada que detecto el
  // problema.
  readonly sessionExpired = signal(false);

  // Referencia al temporizador que vigila la expiracion del token actual,
  // para poder cancelarlo si el usuario cierra sesion o inicia una nueva.
  private expiryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly http: HttpClient) {}

  /**
   * Envia las credenciales al backend. Si son correctas, guarda el token
   * y actualiza el usuario en memoria.
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(tap((response) => this.applySuccessfulLogin(response)));
  }

  /**
   * Envia el ID token entregado por Google Identity Services al backend
   * (POST /api/auth/google). El backend lo verifica, crea o reutiliza el
   * usuario en PostgreSQL, y responde con el mismo formato que el login
   * tradicional, por lo que se reutiliza exactamente la misma logica de
   * sesion (token, usuario en memoria, temporizador de expiracion).
   */
  loginWithGoogle(googleIdToken: string): Observable<GoogleLoginResponse> {
    return this.http
      .post<GoogleLoginResponse>(`${environment.apiUrl}/auth/google`, {
        idToken: googleIdToken,
      })
      .pipe(tap((response) => this.applySuccessfulLogin(response)));
  }

  /** Logica comun tras un login exitoso, sea tradicional o con Google. */
  private applySuccessfulLogin(response: LoginResponse): void {
    this.sessionExpired.set(false);
    this.saveToken(response.token);
    this.currentUser.set(response.user);
    this.scheduleExpiryWatch(response.token);
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

  /** Elimina el token y limpia el usuario en memoria (cierre de sesion normal). */
  logout(): void {
    this.clearExpiryTimer();
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.sessionExpired.set(false);
  }

  /**
   * Se llama cuando el token dejo de ser valido sin que el usuario haya
   * pedido cerrar sesion: expiro por tiempo, o el backend lo rechazo
   * (por ejemplo, en una respuesta 401 de una ruta protegida).
   * Limpia la sesion igual que logout(), pero deja encendida la senal
   * "sessionExpired" para que la interfaz muestre el aviso correspondiente.
   */
  expireSession(): void {
    this.clearExpiryTimer();
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.sessionExpired.set(true);
  }

  /** El usuario ya vio el aviso de expiracion y confirmo volver al login. */
  acknowledgeExpiry(): void {
    this.sessionExpired.set(false);
  }

  /**
   * Reemplaza el token JWT actual por uno renovado (por ejemplo, tras una
   * llamada exitosa a POST /api/auth/session/activity, disparada por
   * actividad real del usuario) y reprograma el temporizador de
   * expiracion local en base a su nuevo "exp". El "sid" interno no
   * cambia; esto solo extiende, en el propio JWT, cuanto tiempo mas
   * puede seguir usandose antes de que el backend vuelva a exigir
   * actividad.
   */
  updateToken(token: string): void {
    this.saveToken(token);
    this.scheduleExpiryWatch(token);
  }

  /**
   * Vuelve a programar el temporizador de expiracion a partir de un token
   * ya guardado en localStorage. Se usa al arrancar la aplicacion (por
   * ejemplo, tras recargar la pagina), para que la sesion siga vigilada
   * aunque el usuario no haya vuelto a iniciar sesion en este momento.
   */
  restoreSessionWatch(): void {
    const token = this.getToken();
    if (token) {
      this.scheduleExpiryWatch(token);
    }
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

  /**
   * Programa un temporizador que se dispara exactamente cuando el token
   * deberia expirar, segun el campo "exp" de su payload. Asi, la sesion
   * se cierra "en tiempo real" apenas se cumple el tiempo configurado en
   * JWT_EXPIRES_IN, sin esperar a que el usuario haga otra peticion.
   */
  private scheduleExpiryWatch(token: string): void {
    this.clearExpiryTimer();

    const expiresAtMs = this.readTokenExpiry(token);
    if (expiresAtMs === null) {
      // No se pudo leer la expiracion (token con formato inesperado):
      // no programamos nada, el backend seguira validando igual en cada
      // peticion protegida.
      return;
    }

    const msRemaining = expiresAtMs - Date.now();

    if (msRemaining <= 0) {
      this.expireSession();
      return;
    }

    this.expiryTimeoutId = setTimeout(() => this.expireSession(), msRemaining);
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimeoutId !== null) {
      clearTimeout(this.expiryTimeoutId);
      this.expiryTimeoutId = null;
    }
  }

  /**
   * Decodifica (sin verificar la firma; eso es responsabilidad exclusiva
   * del backend) el payload de un JWT para leer su fecha de expiracion.
   * Un JWT tiene tres partes separadas por puntos: header.payload.signature.
   * El payload viene en Base64Url, por lo que hay que normalizarlo antes
   * de poder decodificarlo con atob().
   */
  private readTokenExpiry(token: string): number | null {
    try {
      const payloadSegment = token.split(".")[1];
      const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
      const paddedLength = base64.length + ((4 - (base64.length % 4)) % 4);
      const paddedBase64 = base64.padEnd(paddedLength, "=");

      const decodedJson = atob(paddedBase64);
      const payload = JSON.parse(decodedJson) as DecodedJwtPayload;

      if (typeof payload.exp !== "number") {
        return null;
      }

      // "exp" viene en segundos Unix; Date.now() trabaja en milisegundos.
      return payload.exp * 1000;
    } catch {
      return null;
    }
  }
}
