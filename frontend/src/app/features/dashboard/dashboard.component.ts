import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { IncomeService } from "../../core/services/income.service";
import { formatQuetzales } from "../../shared/utils/format-currency";

// Una de las cuatro tarjetas de resumen.
interface SummaryCard {
  title: string;
  value: string;
  caption: string;
}

/**
 * Contenido del Dashboard: icono + titulo + cuadricula de tarjetas.
 * La barra lateral, la barra superior y la verificacion de sesion viven
 * en DashboardShellComponent (componente padre en la ruta), que es quien
 * renderiza este componente dentro de su <router-outlet>.
 *
 * En esta entrega solo "Ingresos" tiene persistencia real en PostgreSQL:
 * su total se consulta al backend (GET /api/incomes/summary) cada vez
 * que se entra al Dashboard. "Gastos" y "Cuentas a pagar" todavia no
 * existen como modulos, asi que se muestran fijos en Q0.00 hasta que se
 * implementen con su propia persistencia. El presupuesto restante se
 * calcula como ingresos - gastos - cuentas por pagar (por ahora, igual
 * al total de ingresos, porque los otros dos son cero).
 */
@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
})
export class DashboardComponent implements OnInit {
  private readonly incomeService = inject(IncomeService);

  readonly isLoadingSummary = signal(true);

  // "Gastos" y "cuentas a pagar" no tienen modulo propio todavia: se
  // dejan en cero de forma explicita, no como un valor inventado, sino
  // como el estado real de "no implementado aun" para esta entrega.
  private readonly expensesTotal = signal(0);
  private readonly billsTotal = signal(0);
  private readonly incomesTotal = signal(0);

  readonly presupuestoRestante = computed(
    () => this.incomesTotal() - this.expensesTotal() - this.billsTotal()
  );

  readonly summaryCards = computed<SummaryCard[]>(() => [
    { title: "GASTOS", value: formatQuetzales(this.expensesTotal()), caption: "total" },
    { title: "INGRESOS", value: formatQuetzales(this.incomesTotal()), caption: "Base" },
    { title: "CUENTAS A PAGAR", value: formatQuetzales(this.billsTotal()), caption: "total" },
    { title: "PRESUPUESTO RESTANTE", value: formatQuetzales(this.presupuestoRestante()), caption: "Base" },
  ]);

  ngOnInit(): void {
    // Se vuelve a consultar cada vez que se entra al Dashboard (por
    // ejemplo, al volver desde Ingresos despues de registrar uno nuevo),
    // sin necesidad de recargar la pagina ni volver a iniciar sesion.
    this.incomeService.summary().subscribe({
      next: (summary) => {
        this.incomesTotal.set(Number(summary.total));
        this.isLoadingSummary.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingSummary.set(false);
        // Si es 401, el interceptor ya activo el aviso global de sesion
        // expirada; para cualquier otro error, las tarjetas simplemente
        // se quedan mostrando Q0.00 en vez de un valor inventado.
        if (error.status !== 401) {
          console.error("No fue posible obtener el resumen de ingresos.", error);
        }
      },
    });
  }
}
