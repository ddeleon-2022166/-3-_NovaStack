import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin } from "rxjs";
import { IncomeService } from "../../core/services/income.service";
import { ExpenseService } from "../../core/services/expense.service";
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
 * "Ingresos" y "Egresos" ya tienen persistencia real en PostgreSQL: sus
 * totales se consultan al backend (GET /api/incomes/summary y
 * GET /api/expenses/summary) cada vez que se entra al Dashboard, incluso
 * al volver desde otra seccion, sin recargar la pagina ni volver a
 * iniciar sesion. "Cuentas a pagar" todavia no existe como modulo, asi
 * que se muestra fija en Q0.00. El presupuesto restante se calcula como
 * ingresos - gastos - cuentas por pagar, nunca como un valor guardado
 * manualmente.
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
  private readonly expenseService = inject(ExpenseService);

  readonly isLoadingSummary = signal(true);

  // "Cuentas a pagar" no tiene modulo propio todavia: se deja en cero de
  // forma explicita, no como un valor inventado, sino como el estado
  // real de "no implementado aun" para esta entrega.
  private readonly billsTotal = signal(0);
  private readonly incomesTotal = signal(0);
  private readonly expensesTotal = signal(0);

  // Por diseño, el backend ya no permite registrar un egreso que supere
  // el saldo disponible (ver expense.service.ts, assertSufficientFunds),
  // asi que en condiciones normales esto nunca deberia dar negativo. Aun
  // asi, se deja el limite explicito en 0 como salvaguarda de
  // presentacion: el cliente nunca debe ver un presupuesto restante en
  // numeros negativos.
  readonly presupuestoRestante = computed(() =>
    Math.max(0, this.incomesTotal() - this.expensesTotal() - this.billsTotal())
  );

  readonly summaryCards = computed<SummaryCard[]>(() => [
    { title: "GASTOS", value: formatQuetzales(this.expensesTotal()), caption: "total" },
    { title: "INGRESOS", value: formatQuetzales(this.incomesTotal()), caption: "Base" },
    { title: "CUENTAS A PAGAR", value: formatQuetzales(this.billsTotal()), caption: "total" },
    { title: "PRESUPUESTO RESTANTE", value: formatQuetzales(this.presupuestoRestante()), caption: "Base" },
  ]);

  ngOnInit(): void {
    // Se vuelve a consultar cada vez que se entra al Dashboard (por
    // ejemplo, al volver desde Ingresos o Egresos despues de registrar
    // algo nuevo), sin necesidad de recargar la pagina ni volver a
    // iniciar sesion.
    forkJoin({
      incomeSummary: this.incomeService.summary(),
      expenseSummary: this.expenseService.summary(),
    }).subscribe({
      next: ({ incomeSummary, expenseSummary }) => {
        this.incomesTotal.set(Number(incomeSummary.total));
        this.expensesTotal.set(Number(expenseSummary.total));
        this.isLoadingSummary.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingSummary.set(false);
        // Si es 401, el interceptor ya activo el aviso global de sesion
        // expirada; para cualquier otro error, las tarjetas simplemente
        // se quedan mostrando Q0.00 en vez de un valor inventado.
        if (error.status !== 401) {
          console.error("No fue posible obtener el resumen financiero.", error);
        }
      },
    });
  }
}
