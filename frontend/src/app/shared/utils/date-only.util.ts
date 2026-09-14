/**
 * Utilidades para trabajar con fechas "solo dia" (columnas DATE de
 * PostgreSQL, formato "AAAA-MM-DD") en Ingresos y Egresos.
 *
 * Se toman siempre los primeros 10 caracteres antes de separar por "-"
 * como blindaje adicional: si por cualquier motivo el backend llegara a
 * enviar una fecha con hora incluida (por ejemplo "2026-09-13T06:00:00.000Z"),
 * esto evita que ese detalle se filtre a la interfaz en vez de romper el
 * formato visualmente.
 */

/** Convierte "AAAA-MM-DD" (o un ISO con hora) a "DD/MM/AAAA" para mostrar en pantalla. */
export function formatDateOnlyLabel(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Convierte un string "AAAA-MM-DD" (o un ISO con hora) a un Date local, sin desplazamientos de zona horaria. */
export function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Convierte un Date a "AAAA-MM-DD" usando sus componentes locales (no UTC). */
export function toDateOnlyIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Fecha de hoy, en la zona horaria local del navegador, como "AAAA-MM-DD". */
export function todayDateOnlyIso(): string {
  return toDateOnlyIso(new Date());
}
