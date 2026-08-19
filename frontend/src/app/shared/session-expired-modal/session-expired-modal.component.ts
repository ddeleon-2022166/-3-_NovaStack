import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

/**
 * Aviso global de "sesion expirada". Vive montado siempre en el
 * componente raiz (app.component.ts), por eso puede aparecer encima de
 * cualquier pantalla en el instante exacto en que el token vence, sin
 * que el usuario tenga que hacer clic en nada para descubrirlo.
 *
 * Se muestra u oculta automaticamente segun la senal
 * "AuthService.sessionExpired", que se activa desde dos lugares:
 * 1. El temporizador interno de AuthService, calculado a partir del
 *    campo "exp" del JWT (expiracion "en tiempo real").
 * 2. El interceptor HTTP, como respaldo, si el backend rechaza el token
 *    en cualquier peticion protegida.
 */
@Component({
  selector: "app-session-expired-modal",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./session-expired-modal.component.html",
  styleUrl: "./session-expired-modal.component.scss",
})
export class SessionExpiredModalComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isVisible = this.authService.sessionExpired;

  goToLogin(): void {
    this.authService.acknowledgeExpiry();
    this.router.navigate(["/login"]);
  }
}
