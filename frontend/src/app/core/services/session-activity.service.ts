import { Injectable, NgZone, effect, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";
import { SESSION_CONFIG } from "../config/session.config";

interface SessionActivityResponse {
  token: string;
}

type BroadcastMessage = { type: "logout" | "expired" };

/**
 * Controla el vencimiento de sesion por inactividad en el frontend.
 *
 * Responsabilidades:
 * - Detectar actividad real del usuario (clic, teclado, tactil,
 *   navegacion) mientras la pestaña esta visible. El movimiento del
 *   mouse, las peticiones automaticas, los temporizadores y las
 *   animaciones NUNCA cuentan como actividad.
 * - Reiniciar un temporizador local de 15 minutos con cada actividad
 *   valida; si se cumple sin nueva actividad, cierra la sesion local y
 *   muestra el modal existente (via AuthService.expireSession()).
 * - Informar la actividad al backend (POST /api/auth/session/activity),
 *   limitado a como maximo una vez por minuto, y guardar el JWT
 *   renovado que el backend devuelve.
 * - Comprobar la sesion al recuperar el foco o la visibilidad de la
 *   pestaña (por ejemplo, tras salir de suspension).
 * - Sincronizar el cierre de sesion entre pestañas mediante
 *   BroadcastChannel.
 *
 * El temporizador local es solo una capa de UX: el backend es quien
 * realmente hace cumplir el limite de inactividad y el limite absoluto
 * en cada peticion protegida (ver backend/src/middlewares/auth.middleware.ts).
 *
 * Debe iniciarse una unica vez desde el componente raiz (AppComponent),
 * llamando a init(). A partir de ahi, el propio servicio activa o
 * desactiva sus temporizadores y listeners segun el estado de sesion de
 * AuthService (comienza a funcionar despues del login, se detiene al
 * cerrar sesion).
 */
@Injectable({ providedIn: "root" })
export class SessionActivityService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);

  private initialized = false;
  private listenersActive = false;
  private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastActivityPingAt = 0;
  private broadcastChannel: BroadcastChannel | null = null;
  private applyingRemoteEvent = false;
  private wasLoggedIn = false;

  private readonly onActivityEvent = () => this.handleActivity();
  private readonly onVisibilityChange = () => this.handleVisibilityChange();

  constructor() {
    // Reacciona al estado de sesion de AuthService: arranca los
    // temporizadores y listeners despues del login, y los detiene al
    // cerrar sesion (manual o por vencimiento), sea cual sea el motivo.
    effect(() => {
      const isLoggedIn = this.authService.currentUser() !== null;
      const expired = this.authService.sessionExpired();

      if (isLoggedIn) {
        this.startTracking();
      } else {
        this.stopTracking();
      }

      // La sesion acaba de terminar en esta pestaña: sincroniza el
      // cierre con las demas, salvo que el cierre haya llegado desde
      // otra pestaña (para evitar un ida-y-vuelta de mensajes).
      if (this.wasLoggedIn && !isLoggedIn && !this.applyingRemoteEvent) {
        this.postMessage(expired ? "expired" : "logout");
      }

      this.wasLoggedIn = isLoggedIn;
    });
  }

  /** Debe llamarse una sola vez, desde el componente raiz de la aplicacion. */
  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.setupBroadcastChannel();
  }

  private startTracking(): void {
    if (this.listenersActive) {
      return;
    }
    this.listenersActive = true;
    this.attachActivityListeners();
    this.resetIdleTimer();
  }

  private stopTracking(): void {
    this.listenersActive = false;
    this.detachActivityListeners();
    this.clearIdleTimer();
  }

  private attachActivityListeners(): void {
    // Los listeners de actividad no necesitan disparar deteccion de
    // cambios de Angular por si mismos (solo actualizan un temporizador
    // y, como maximo una vez por minuto, hacen una llamada HTTP), asi
    // que se registran fuera de NgZone por rendimiento.
    this.zone.runOutsideAngular(() => {
      window.addEventListener("click", this.onActivityEvent, { passive: true });
      window.addEventListener("keydown", this.onActivityEvent, { passive: true });
      window.addEventListener("touchstart", this.onActivityEvent, { passive: true });
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    });
  }

  private detachActivityListeners(): void {
    window.removeEventListener("click", this.onActivityEvent);
    window.removeEventListener("keydown", this.onActivityEvent);
    window.removeEventListener("touchstart", this.onActivityEvent);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  /** Actividad valida: clic, teclado, tactil o navegacion (los clics de RouterLink ya quedan cubiertos por "click"). */
  private handleActivity(): void {
    if (!this.listenersActive || document.hidden) {
      // La actividad con la pestaña oculta no cuenta.
      return;
    }
    this.resetIdleTimer();
    this.notifyActivityToBackend();
  }

  /** Al recuperar el foco o la visibilidad, se comprueba la sesion contra el backend (por ejemplo, tras salir de suspension). */
  private handleVisibilityChange(): void {
    if (document.hidden || !this.listenersActive) {
      return;
    }
    this.notifyActivityToBackend(true);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimeoutId = setTimeout(() => this.handleIdleTimeout(), SESSION_CONFIG.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimeoutId !== null) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
  }

  private handleIdleTimeout(): void {
    // El temporizador local vencio: se cierra la sesion de inmediato en
    // esta pestaña. Si la sesion ya venciera igualmente en el backend
    // (lo usual), la proxima peticion habria devuelto 401 de todas
    // formas; esto solo evita esperar a esa peticion para avisar.
    this.zone.run(() => this.authService.expireSession());
  }

  /**
   * Notifica actividad real al backend, limitado a como maximo una vez
   * por minuto (SESSION_CONFIG.activityThrottleMs), para que Angular no
   * envie una solicitud por cada evento. La comprobacion de foco/
   * visibilidad puede saltarse el limite ("force") para confirmar la
   * sesion de inmediato al volver a la pestaña.
   */
  private notifyActivityToBackend(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastActivityPingAt < SESSION_CONFIG.activityThrottleMs) {
      return;
    }
    this.lastActivityPingAt = now;

    this.http
      .post<SessionActivityResponse>(`${environment.apiUrl}/auth/session/activity`, {})
      .subscribe({
        next: (response) => {
          if (response?.token) {
            this.zone.run(() => this.authService.updateToken(response.token));
          }
        },
        // Si el backend responde 401, el interceptor ya se encarga de
        // llamar a AuthService.expireSession(); no se duplica esa
        // logica aqui, y no se reintenta la llamada.
        error: () => undefined,
      });
  }

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === "undefined") {
      // Navegador sin soporte: la sesion sigue funcionando en cada
      // pestaña de forma independiente, solo se pierde la sincronizacion.
      return;
    }

    this.broadcastChannel = new BroadcastChannel(SESSION_CONFIG.broadcastChannelName);
    this.broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      this.applyingRemoteEvent = true;
      try {
        if (event.data?.type === "expired") {
          this.zone.run(() => this.authService.expireSession());
        } else if (event.data?.type === "logout") {
          this.zone.run(() => this.authService.logout());
        }
      } finally {
        this.applyingRemoteEvent = false;
      }
    };
  }

  private postMessage(type: BroadcastMessage["type"]): void {
    this.broadcastChannel?.postMessage({ type } satisfies BroadcastMessage);
  }
}
