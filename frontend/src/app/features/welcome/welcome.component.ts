import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-welcome",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./welcome.component.html",
  styleUrl: "./welcome.component.scss",
})
export class WelcomeComponent implements OnInit {
  readonly isVerifying = signal(true);
  readonly verificationFailed = signal(false);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // Confirma que el token siga siendo valido consultando la ruta protegida
    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        this.isVerifying.set(false);
      },
      error: () => {
        this.isVerifying.set(false);
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
