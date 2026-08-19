import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-welcome",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./welcome.component.html",
  styleUrl: "./welcome.component.scss",
})
export class WelcomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isVerifying = signal(true);
  readonly verificationFailed = signal(false);
  readonly currentUser = this.authService.currentUser;

  ngOnInit(): void {
    // Confirma que el token siga siendo valido consultando la ruta protegida
    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        this.isVerifying.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isVerifying.set(false);

        if (error.status === 401) {
          // El interceptor ya detecto el 401, limpio la sesion y activo
          // el aviso global de "sesion expirada" (AuthService.expireSession()).
          // Aqui no hace falta redirigir de inmediato: dejamos que el
          // usuario vea el aviso y confirme con el boton del modal.
          return;
        }

        // Cualquier otro error (por ejemplo, el backend esta apagado)
        // si amerita volver directamente al login.
        this.verificationFailed.set(true);
        this.authService.logout();
        this.router.navigate(["/login"]);
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }
}
