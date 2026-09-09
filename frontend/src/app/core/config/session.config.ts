/**
 * Configuracion centralizada del control de sesion por inactividad en
 * Angular. El backend es siempre la fuente de verdad (comprueba
 * inactividad y duracion maxima absoluta en PostgreSQL en cada peticion
 * protegida); estos valores solo controlan la capa de UX local: cuando
 * mostrar el aviso sin esperar una respuesta del servidor, y con que
 * frecuencia maxima notificar actividad al backend.
 *
 * "idleTimeoutMs" debe coincidir con SESSION_IDLE_TIMEOUT_MINUTES del
 * backend (backend/.env.example).
 */
export const SESSION_CONFIG = {
  /** Minutos de inactividad tras los cuales se cierra la sesion localmente. */
  idleTimeoutMs: 15 * 60 * 1000,
  /** Frecuencia maxima para notificar actividad real al backend. */
  activityThrottleMs: 60 * 1000,
  /** Nombre del canal usado para sincronizar el cierre de sesion entre pestañas. */
  broadcastChannelName: "novastack-session",
} as const;
