import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../../core/services/auth.service";

// Un item de la navegacion lateral (Informe, Historial, Ingresos).
// "route" solo se define para las secciones que ya existen; Informe e
// Historial todavia no estan implementadas, por lo que se muestran sin
// enlace (visualmente presentes, pero sin navegar a paginas inventadas).
interface SidebarNavItem {
  label: string;
  icon: "informe" | "historial" | "ingresos";
  route?: string;
}

// Un item de la barra superior (Periodos, Movimientos, Objetivos).
// Se muestran visualmente (tal como pide la maqueta) pero no navegan a
// ninguna pagina inventada, porque esas secciones no existen todavia.
interface TopNavItem {
  label: string;
}

/**
 * Layout compartido del area autenticada de la aplicacion: barra lateral,
 * barra superior y un <router-outlet> donde se renderiza cada seccion
 * (Dashboard, Ingresos, y las que se agreguen mas adelante).
 *
 * Este componente centraliza, en un solo lugar, todo lo que antes vivia
 * duplicado dentro de DashboardComponent: la verificacion de sesion
 * contra el backend, los datos del usuario para la barra superior, y el
 * marcado de la barra lateral. Asi, agregar una nueva seccion protegida
 * (como Ingresos) no requiere repetir sidebar ni topbar en cada
 * componente de pantalla.
 */
@Component({
  selector: "app-dashboard-shell",
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./dashboard-shell.component.html",
  styleUrl: "./dashboard-shell.component.scss",
})
export class DashboardShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isVerifying = signal(true);
  readonly currentUser = this.authService.currentUser;

  // Nombre a mostrar en la barra superior: el nombre publico del usuario
  // autenticado (obtenido del backend via AuthService), en mayusculas
  // para respetar el estilo tipografico de la maqueta.
  readonly displayName = computed(() => this.currentUser()?.name?.toUpperCase() ?? "");

  // Identificador corto a mostrar debajo del nombre. Como el modelo de
  // usuario de esta entrega no incluye un codigo de estudiante o carnet,
  // se deriva del correo (la parte antes de "@"), que es el unico dato
  // publico disponible para ese proposito.
  readonly userIdentifier = computed(() => this.currentUser()?.email.split("@")[0] ?? "");

  readonly sidebarNavItems: SidebarNavItem[] = [
    { label: "Informe", icon: "informe" },
    { label: "Historial", icon: "historial" },
    { label: "Ingresos", icon: "ingresos", route: "/ingresos" },
  ];

  readonly topNavItems: TopNavItem[] = [
    { label: "Periodos" },
    { label: "Movimientos" },
    { label: "Objetivos" },
  ];

  ngOnInit(): void {
    // Se confirma la sesion contra el backend una sola vez, antes de
    // mostrar cualquier seccion protegida (Dashboard, Ingresos, etc.).
    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        this.isVerifying.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isVerifying.set(false);

        if (error.status === 401) {
          // El interceptor ya activo el aviso global de sesion expirada;
          // no hace falta redirigir manualmente aqui.
          return;
        }

        // Cualquier otro error (por ejemplo, el backend esta apagado):
        // se cierra la sesion local y se regresa al login.
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
