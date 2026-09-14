import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../../../core/services/auth.service";
import { ApiErrorResponse } from "../../../core/models/auth.models";
import { environment } from "../../../../environments/environment";

// Tipado minimo de la libreria "Google Identity Services", cargada en
// index.html mediante <script src="https://accounts.google.com/gsi/client">.
// No se instala un paquete de tipos adicional para mantener el alcance de
// esta entrega acotado unicamente al login con Google.
interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        itp_support?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          shape?: "rectangular" | "pill" | "circle" | "square";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          width?: number;
          logo_alignment?: "left" | "center";
        }
      ): void;
    };
  };
}

declare const google: GoogleIdentityServices | undefined;

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  private static readonly GOOGLE_RETRY_INTERVAL_MS = 250;
  // 40 intentos de 250 ms = 10 segundos de margen: mas que suficiente
  // incluso en una red lenta (institucional) para que termine de cargar
  // el script de Google Identity Services.
  private static readonly GOOGLE_RETRY_MAX_ATTEMPTS = 40;

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild("googleButtonContainer") private readonly googleButtonContainer?: ElementRef<HTMLDivElement>;

  private googleRetryIntervalId: ReturnType<typeof setInterval> | null = null;
  private googleRetryAttempts = 0;

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  // Controla si se muestra el separador y el boton de Google: si el
  // Client ID no esta configurado en este entorno, se oculta por completo
  // en vez de mostrar un boton que fallaria al usarse.
  readonly googleSignInAvailable = signal(false);

  readonly form = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required]],
  });

  ngAfterViewInit(): void {
    this.initializeGoogleSignIn();
  }

  ngOnDestroy(): void {
    this.clearGoogleRetryTimer();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const { email, password } = this.form.getRawValue();

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(["/dashboard"]);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  /**
   * Prepara el boton "Continuar con Google" mediante Google Identity
   * Services. El script (cargado en index.html con "async defer") puede
   * tardar en estar disponible, sobre todo en redes lentas: por eso,
   * en vez de comprobarlo una sola vez, se reintenta periodicamente
   * durante unos segundos antes de darlo por no disponible. Esto es lo
   * que antes causaba que el boton solo apareciera al recargar la
   * pagina o volver a entrar al login (para ese momento, el script ya
   * habia terminado de cargar en segundo plano).
   */
  private initializeGoogleSignIn(): void {
    const clientId = environment.googleClientId;

    if (!clientId || !this.googleButtonContainer) {
      return;
    }

    if (typeof google !== "undefined") {
      this.renderGoogleButton(clientId, google);
      return;
    }

    this.googleRetryAttempts = 0;
    this.googleRetryIntervalId = setInterval(() => {
      this.googleRetryAttempts += 1;

      if (typeof google !== "undefined") {
        this.clearGoogleRetryTimer();
        this.renderGoogleButton(clientId, google);
        return;
      }

      if (this.googleRetryAttempts >= LoginComponent.GOOGLE_RETRY_MAX_ATTEMPTS) {
        // Se agoto el tiempo de espera: probablemente la red bloquea o
        // no logra cargar el script. El login tradicional sigue
        // funcionando sin ningun cambio; el boton simplemente no aparece.
        this.clearGoogleRetryTimer();
      }
    }, LoginComponent.GOOGLE_RETRY_INTERVAL_MS);
  }

  private renderGoogleButton(clientId: string, googleApi: GoogleIdentityServices): void {
    if (!this.googleButtonContainer) {
      return;
    }

    googleApi.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => this.handleGoogleCredential(response),
    });

    googleApi.accounts.id.renderButton(this.googleButtonContainer.nativeElement, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 320,
      logo_alignment: "left",
    });

    this.googleSignInAvailable.set(true);
  }

  private clearGoogleRetryTimer(): void {
    if (this.googleRetryIntervalId !== null) {
      clearInterval(this.googleRetryIntervalId);
      this.googleRetryIntervalId = null;
    }
  }

  /** Callback de Google Identity Services al completar el inicio de sesion. */
  private handleGoogleCredential(response: GoogleCredentialResponse): void {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    this.authService.loginWithGoogle(response.credential).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(["/dashboard"]);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "No fue posible conectarse con el servidor. Verifica que el backend este activo.";
    }

    const body = error.error as ApiErrorResponse | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrio un error inesperado. Intenta nuevamente.";
  }
}
