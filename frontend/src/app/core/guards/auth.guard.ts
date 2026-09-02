import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

/**
 * Guard funcional que impide el acceso al area autenticada (Dashboard,
 * Ingresos, y cualquier otra seccion que se agregue bajo el mismo layout)
 * si no existe un token guardado. No valida el token contra el backend
 * (eso lo hace DashboardShellComponent mediante /api/auth/me); este guard
 * solo evita la navegacion cuando es evidente que no hay sesion.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasToken()) {
    return true;
  }

  router.navigate(["/login"]);
  return false;
};
