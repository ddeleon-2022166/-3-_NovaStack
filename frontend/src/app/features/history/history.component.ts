import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin } from "rxjs";
import { IncomeService } from "../../core/services/income.service";
import { ExpenseService } from "../../core/services/expense.service";
import { formatQuetzales } from "../../shared/utils/format-currency";
import {
  DEFAULT_HISTORY_FILTERS,
  HistoryFilters,
  Movement,
  MovementTypeFilter,
  PeriodPreset,
} from "./history.models";

const PAGE_SIZE = 10;

/**
 * Historial: combina los ingresos y los egresos ya existentes (mismos
 * servicios y endpoints que las secciones Ingresos y "Egresos", que en
 * la barra lateral aparece con la etiqueta ya existente para esa
 * seccion) en una sola vista de consulta, con filtros, tarjetas de
 * resumen, tabla unificada y paginacion.
 *
 * No se creo ningun endpoint nuevo en el backend: esta vista es de solo
 * lectura, y ambas fuentes (GET /api/incomes y GET /api/expenses) ya
 * devuelven unicamente los registros del usuario autenticado.
 */
@Component({
  selector: "app-history",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./history.component.html",
  styleUrl: "./history.component.scss",
})
export class HistoryComponent implements OnInit {
  private readonly incomeService = inject(IncomeService);
  private readonly expenseService = inject(ExpenseService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // Todos los movimientos del usuario, ya combinados y ordenados del mas
  // reciente al mas antiguo. Los filtros y la paginacion se aplican
  // sobre esta lista, sin volver a consultar el backend.
  private readonly allMovements = signal<Movement[]>([]);

  // Filtros "en borrador": lo que el usuario esta ajustando en el panel,
  // antes de presionar "Aplicar filtros".
  readonly draftFilters = signal<HistoryFilters>({ ...DEFAULT_HISTORY_FILTERS });

  // Filtros realmente aplicados: la tabla, las tarjetas y la paginacion
  // solo reaccionan a este valor, no al borrador.
  private readonly appliedFilters = signal<HistoryFilters>({ ...DEFAULT_HISTORY_FILTERS });

  readonly dateRangeError = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly selectedMovement = signal<Movement | null>(null);

  readonly periodOptions: { value: PeriodPreset; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "ultimo_mes", label: "Último mes" },
    { value: "ultimos_7", label: "Últimos 7 días" },
    { value: "este_mes", label: "Este mes" },
  ];

  readonly typeOptions: { value: MovementTypeFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "ingreso", label: "Ingreso" },
    { value: "egreso", label: "Egreso" },
  ];

  // Las categorias del filtro se obtienen de los movimientos reales del
  // usuario, no de una lista fija: si todavia no tiene registros en
  // alguna categoria, esa categoria simplemente no aparece como opcion.
  readonly availableCategories = computed<string[]>(() => {
    const categories = new Set(this.allMovements().map((movement) => movement.category));
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  });

  readonly filteredMovements = computed<Movement[]>(() =>
    this.filterMovements(this.allMovements(), this.appliedFilters())
  );

  readonly totalCount = computed(() => this.filteredMovements().length);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  readonly pagedMovements = computed<Movement[]>(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    return this.filteredMovements().slice(start, start + PAGE_SIZE);
  });

  readonly rangeStart = computed(() => (this.totalCount() === 0 ? 0 : (this.currentPage() - 1) * PAGE_SIZE + 1));
  readonly rangeEnd = computed(() => Math.min(this.currentPage() * PAGE_SIZE, this.totalCount()));

  readonly hasActiveFilters = computed(() => {
    const filters = this.appliedFilters();
    return (
      filters.period !== "todos" ||
      filters.type !== "todos" ||
      filters.category !== "todas" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.search.trim() !== ""
    );
  });

  readonly summary = computed(() => {
    const movements = this.filteredMovements();
    let totalIncome = 0;
    let totalExpense = 0;

    for (const movement of movements) {
      if (movement.type === "ingreso") {
        totalIncome += movement.amount;
      } else {
        totalExpense += movement.amount;
      }
    }

    return {
      totalIncomeFormatted: formatQuetzales(totalIncome),
      totalExpenseFormatted: formatQuetzales(totalExpense),
      netBalanceFormatted: formatQuetzales(totalIncome - totalExpense),
      count: movements.length,
    };
  });

  ngOnInit(): void {
    this.loadMovements();
  }

  updateDraftFilter<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]): void {
    this.draftFilters.update((current) => ({ ...current, [key]: value }));
  }

  /** Se llama desde el boton "Aplicar filtros" del panel. */
  applyFilters(): void {
    const draft = this.draftFilters();

    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
      this.dateRangeError.set("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
      return;
    }

    this.dateRangeError.set(null);
    this.appliedFilters.set({ ...draft });
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.draftFilters.set({ ...DEFAULT_HISTORY_FILTERS });
    this.appliedFilters.set({ ...DEFAULT_HISTORY_FILTERS });
    this.dateRangeError.set(null);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const clamped = Math.min(Math.max(1, page), this.totalPages());
    this.currentPage.set(clamped);
  }

  viewDetail(movement: Movement): void {
    this.selectedMovement.set(movement);
  }

  closeDetail(): void {
    this.selectedMovement.set(null);
  }

  formatAmount(movement: Movement): string {
    return formatQuetzales(movement.amount);
  }

  formatDateLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  private filterMovements(movements: Movement[], filters: HistoryFilters): Movement[] {
    return movements.filter((movement) => this.movementMatchesFilters(movement, filters));
  }

  private movementMatchesFilters(movement: Movement, filters: HistoryFilters): boolean {
    if (!this.matchesPeriod(movement.date, filters.period)) {
      return false;
    }

    if (filters.type !== "todos" && movement.type !== filters.type) {
      return false;
    }

    if (filters.category !== "todas" && movement.category !== filters.category) {
      return false;
    }

    if (filters.dateFrom && movement.date < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && movement.date > filters.dateTo) {
      return false;
    }

    const term = filters.search.trim().toLowerCase();
    if (term) {
      const haystack = `${movement.description} ${movement.category}`.toLowerCase();
      if (!haystack.includes(term)) {
        return false;
      }
    }

    return true;
  }

  private matchesPeriod(isoDate: string, preset: PeriodPreset): boolean {
    if (preset === "todos") {
      return true;
    }

    const movementDate = new Date(`${isoDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (preset === "ultimos_7") {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return movementDate >= from && movementDate <= today;
    }

    if (preset === "ultimo_mes") {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return movementDate >= from && movementDate <= today;
    }

    // "este_mes": mismo mes y año calendario que hoy.
    return (
      movementDate.getFullYear() === today.getFullYear() &&
      movementDate.getMonth() === today.getMonth()
    );
  }

  private loadMovements(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      incomes: this.incomeService.list(),
      expenses: this.expenseService.list(),
    }).subscribe({
      next: ({ incomes, expenses }) => {
        const incomeMovements: Movement[] = incomes.incomes.map((income) => ({
          id: income.id,
          type: "ingreso",
          description: income.description,
          category: income.category,
          amount: Number(income.amount),
          date: income.incomeDate,
          createdAt: income.createdAt,
        }));

        const expenseMovements: Movement[] = expenses.expenses.map((expense) => ({
          id: expense.id,
          type: "egreso",
          description: expense.description,
          category: expense.category,
          amount: Number(expense.amount),
          date: expense.expenseDate,
          createdAt: expense.createdAt,
        }));

        const combined = [...incomeMovements, ...expenseMovements].sort((a, b) => {
          if (a.date !== b.date) {
            return a.date > b.date ? -1 : 1;
          }
          // Mismo dia: se desempata con la hora real de creacion del
          // registro, del mas reciente al mas antiguo.
          return a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0;
        });

        this.allMovements.set(combined);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);

        if (error.status === 401) {
          // El interceptor ya activo el aviso global de sesion expirada.
          return;
        }

        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "No fue posible conectarse con el servidor. Intente nuevamente.";
    }

    const body = error.error as { message?: string } | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrió un error inesperado al consultar el historial.";
  }
}
