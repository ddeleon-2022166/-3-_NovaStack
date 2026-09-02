/**
 * Formatea un monto (numero o el texto que devuelve PostgreSQL para una
 * columna NUMERIC) como quetzales con separador de miles y dos
 * decimales, por ejemplo: formatQuetzales("2500") -> "Q2,500.00".
 *
 * Se centraliza aqui porque tanto el Dashboard como Ingresos necesitan
 * mostrar montos con el mismo formato.
 */
export function formatQuetzales(amount: number | string): string {
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  const formatted = safeAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `Q${formatted}`;
}
