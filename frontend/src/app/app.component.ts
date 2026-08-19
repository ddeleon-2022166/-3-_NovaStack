import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AuthService } from "./core/services/auth.service";
import { SessionExpiredModalComponent } from "./shared/session-expired-modal/session-expired-modal.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, SessionExpiredModalComponent],
  template: `
    <router-outlet></router-outlet>
    <app-session-expired-modal></app-session-expired-modal>
  `,
})
export class AppComponent implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    // Si ya existia un token guardado (por ejemplo, el usuario recargo la
    // pagina), volvemos a programar el temporizador de expiracion para
    // que la sesion siga vigilada en tiempo real.
    this.authService.restoreSessionWatch();
  }
}
