import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";

/**
 * Interceptor funcional que:
 * 1. Agrega el encabezado "Authorization: Bearer <token>" a las
 *    solicitudes dirigidas a la API, unicamente cuando existe un token
 *    guardado.
 * 2. Sirve como respaldo del temporizador de expiracion: si una peticion
 *    que SI llevaba token recibe un 401 (token vencido o invalidado por
 *    el backend), se activa la senal global de sesion expirada, para que
 *    la interfaz muestre el aviso aunque el temporizador no se haya
 *    disparado todavia (por ejemplo, por un pequeno desfase de reloj).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const authenticatedRequest = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo tratamos el 401 como "sesion expirada" si la peticion
      // realmente llevaba un token (para no disparar el aviso cuando el
      // 401 viene, por ejemplo, de un login con credenciales incorrectas,
      // que nunca envia Authorization).
      //
      // El backend distingue el vencimiento por inactividad (o por
      // duracion maxima absoluta) con { code: "SESSION_EXPIRED" }, pero
      // cualquier 401 sobre una peticion autenticada recibe el mismo
      // tratamiento aqui: en todos los casos la sesion local ya no es
      // valida. expireSession() es idempotente (activa una signal que ya
      // puede estar en true), por lo que nunca se muestra mas de un
      // modal aunque varias peticiones fallen a la vez, y no se reintenta
      // renovar una sesion que el backend ya rechazo.
      if (token && error.status === 401) {
        authService.expireSession();
      }
      return throwError(() => error);
    })
  );
};
