import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../../core/services/auth.service";

// Ancho de pantalla (en px) a partir del cual se considera "movil" para
// efectos de la sidebar: por debajo de este umbral, navegar a una
// seccion cierra la sidebar automaticamente (mismo breakpoint que ya
// usan los estilos responsive del shell).
const MOBILE_BREAKPOINT_PX = 860;

// Un item de la navegacion lateral (Egresos, Historial, Ingresos).
// Los tres tienen ruta real: Historial se conecto a /historial en esta
// entrega (antes solo era un boton visual sin destino).
interface SidebarNavItem {
  label: string;
  icon: "egresos" | "historial" | "ingresos";
  route: string;
}

// Un item de la barra superior (Periodos, Movimientos, Objetivos).
// "route" es opcional, pero los tres ya navegan a una pagina real.
interface TopNavItem {
  label: string;
  route?: string;
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

  // Estado de visibilidad de la sidebar. Empieza visible siempre (tanto
  // en escritorio como en movil); el boton de la topbar la alterna, y
  // en pantallas angostas se cierra sola al navegar a una seccion.
  readonly isSidebarOpen = signal(true);

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
    { label: "Informe", icon: "egresos", route: "/egresos" },
    { label: "Historial", icon: "historial", route: "/historial" },
    { label: "Ingresos", icon: "ingresos", route: "/ingresos" },
  ];

  readonly topNavItems: TopNavItem[] = [
    { label: "Periodos", route: "/periodos" },
    { label: "Movimientos", route: "/movimientos" },
    { label: "Objetivos", route: "/objetivos" },
  ];

  ngOnInit(): void {
    // En pantallas angostas, al navegar a otra seccion se cierra la
    // sidebar automaticamente (patron habitual de menus moviles: la
    // navegacion ya cumplio su proposito, no hace falta que el menu
    // siga ocupando la pantalla).
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart && this.isMobileViewport()) {
        this.isSidebarOpen.set(false);
      }
    });

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

  /** Alterna la visibilidad de la sidebar (boton de la topbar). */
  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  private isMobileViewport(): boolean {
    return typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT_PX;
  }
}
