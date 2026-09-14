import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { Observable, forkJoin } from "rxjs";
import { IncomeService } from "../../core/services/income.service";
import { ExpenseService } from "../../core/services/expense.service";
import { PeriodService } from "../../core/services/period.service";
import { CreateIncomeRequest, INCOME_CATEGORIES } from "../../core/models/income.models";
import { EXPENSE_CATEGORIES, ExpenseRequest } from "../../core/models/expense.models";
import { Period } from "../../core/models/period.models";
import { formatQuetzales } from "../../shared/utils/format-currency";
import {
  DEFAULT_MOVEMENT_FILTERS,
  Movement,
  MovementFilters,
  MovementType,
  MovementTypeFilter,
} from "./movements.models";

const PAGE_SIZE = 10;

/** Valida que el monto ingresado sea un numero mayor que cero. */
function positiveAmountValidator(control: AbstractControl): ValidationErrors | null {
  const numericValue = Number(control.value);
  if (control.value === "" || !Number.isFinite(numericValue) || numericValue <= 0) {
    return { positiveAmount: true };
  }
  return null;
}

/**
 * Seccion "Movimientos": combina los ingresos y los egresos ya
 * existentes (mismos servicios y endpoints reales que Ingresos y
 * Egresos) en una sola vista con resumen, filtros, formulario de
 * creacion/edicion y listado unificado.
 *
 * No se crea ningun endpoint, modelo ni campo nuevo en el backend: cada
 * movimiento sigue viviendo en "incomes" o "expenses" segun su tipo
 * original, y esta vista solo los combina en el frontend (igual que ya
 * hace Historial). El filtro de "Periodo" reutiliza los periodos reales
 * de la seccion Periodos, comparando el rango de fechas de cada uno
 * contra la fecha del movimiento (la misma logica que ya usa el backend
 * en period.model.ts para calcular los totales de cada periodo).
 */
@Component({
  selector: "app-movements",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./movements.component.html",
  styleUrl: "./movements.component.scss",
})
export class MovementsComponent implements OnInit {
  private readonly incomeService = inject(IncomeService);
  private readonly expenseService = inject(ExpenseService);
  private readonly periodService = inject(PeriodService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly incomeCategories = INCOME_CATEGORIES;
  readonly expenseCategories = EXPENSE_CATEGORIES;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  private readonly allMovements = signal<Movement[]>([]);
  readonly periods = signal<Period[]>([]);

  // Controla que el periodo activo solo se preseleccione una vez, en la
  // primera carga: si el usuario luego elige "Todos" a proposito, las
  // siguientes recargas (por ejemplo, tras guardar un movimiento) no
  // deben pisar esa eleccion.
  private hasAppliedDefaultPeriod = false;

  // Filtros "en borrador" (panel) vs. realmente aplicados (tabla y
  // tarjetas), igual que en Historial: la tabla solo reacciona al hacer
  // clic en "Aplicar filtros".
  readonly draftFilters = signal<MovementFilters>({ ...DEFAULT_MOVEMENT_FILTERS });
  private readonly appliedFilters = signal<MovementFilters>({ ...DEFAULT_MOVEMENT_FILTERS });

  readonly dateRangeError = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly selectedMovement = signal<Movement | null>(null);

  readonly typeOptions: { value: MovementTypeFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "ingreso", label: "Ingreso" },
    { value: "egreso", label: "Egreso" },
  ];

  readonly availableCategories = computed<string[]>(() => {
    const categories = new Set(this.allMovements().map((movement) => movement.category));
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  });

  // ============ Formulario de creacion / edicion ============
  // El formulario se muestra siempre en el panel principal (igual que
  // la maqueta), no como modal: sirve tanto para crear un movimiento
  // nuevo como para editar uno existente, segun "editingId".

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);
  readonly formType = signal<MovementType>("ingreso");

  readonly formCategories = computed(() =>
    this.formType() === "ingreso" ? this.incomeCategories : this.expenseCategories
  );

  readonly form = this.formBuilder.group({
    description: ["", [Validators.required, Validators.maxLength(255)]],
    amount: ["", [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/), positiveAmountValidator]],
    category: ["", [Validators.required]],
    date: ["", [Validators.required]],
  });

  // ============ Filtros + tabla ============

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

  readonly rangeStart = computed(() =>
    this.totalCount() === 0 ? 0 : (this.currentPage() - 1) * PAGE_SIZE + 1
  );
  readonly rangeEnd = computed(() => Math.min(this.currentPage() * PAGE_SIZE, this.totalCount()));

  readonly hasActiveFilters = computed(() => {
    const filters = this.appliedFilters();
    return (
      filters.periodId !== "todos" ||
      filters.type !== "todos" ||
      filters.category !== "todas" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.search.trim() !== ""
    );
  });

  // ============ Tarjetas de resumen (sobre el resultado filtrado) ============

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
    this.loadAll();
  }

  // ============ Filtros ============

  updateDraftFilter<K extends keyof MovementFilters>(key: K, value: MovementFilters[K]): void {
    this.draftFilters.update((current) => ({ ...current, [key]: value }));
  }

  applyFilters(): void {
    const draft = this.draftFilters();

    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
      this.dateRangeError.set("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    this.dateRangeError.set(null);
    this.appliedFilters.set({ ...draft });
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.draftFilters.set({ ...DEFAULT_MOVEMENT_FILTERS });
    this.appliedFilters.set({ ...DEFAULT_MOVEMENT_FILTERS });
    this.dateRangeError.set(null);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  // ============ Detalle ============

  viewDetail(movement: Movement): void {
    this.selectedMovement.set(movement);
  }

  closeDetail(): void {
    this.selectedMovement.set(null);
  }

  // ============ Crear / editar ============

  selectFormType(type: MovementType): void {
    if (this.isEditing()) {
      // El tipo no se puede cambiar al editar: un ingreso y un egreso
      // son registros de tablas distintas en el backend.
      return;
    }
    if (this.formType() === type) {
      return;
    }
    this.formType.set(type);
    this.form.patchValue({ category: "" });
  }

  startEdit(movement: Movement): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.editingId.set(movement.id);
    this.formType.set(movement.type);
    this.form.setValue({
      description: movement.description,
      amount: String(movement.amount),
      category: movement.category,
      date: movement.date,
    });
  }

  cancelForm(): void {
    this.resetForm();
  }

  /** Botón "Nuevo movimiento" del encabezado: deja el formulario listo para un registro nuevo. */
  startCreate(): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.resetForm();
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.formError.set(null);
    this.isSubmitting.set(true);

    const { description, amount, category, date } = this.form.getRawValue();
    const type = this.formType();
    const editingId = this.editingId();

    const request$: Observable<unknown> =
      type === "ingreso"
        ? this.saveIncome(editingId, { description, amount: Number(amount), category, incomeDate: date })
        : this.saveExpense(editingId, { description, amount: Number(amount), category, expenseDate: date });

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set(
          editingId ? "Movimiento actualizado correctamente." : "Movimiento registrado correctamente."
        );
        this.resetForm();
        this.loadAll();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.formError.set(this.resolveErrorMessage(error));
      },
    });
  }

  confirmDelete(movement: Movement): void {
    const confirmed = window.confirm(
      `¿Confirma que desea eliminar el movimiento "${movement.description}" por ${formatQuetzales(movement.amount)}?`
    );

    if (!confirmed) {
      return;
    }

    this.actionError.set(null);

    const request$: Observable<{ message: string }> =
      movement.type === "ingreso"
        ? this.incomeService.delete(movement.id)
        : this.expenseService.delete(movement.id);

    request$.subscribe({
      next: () => {
        if (this.editingId() === movement.id) {
          this.resetForm();
        }
        this.loadAll();
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(this.resolveErrorMessage(error));
      },
    });
  }

  // ============ Utilidades de formato ============

  formatAmount(movement: Movement): string {
    return formatQuetzales(movement.amount);
  }

  formatDateLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  periodLabel(period: Period): string {
    return period.name;
  }

  private saveIncome(
    editingId: string | null,
    payload: CreateIncomeRequest
  ): Observable<unknown> {
    return editingId ? this.incomeService.update(editingId, payload) : this.incomeService.create(payload);
  }

  private saveExpense(editingId: string | null, payload: ExpenseRequest): Observable<unknown> {
    return editingId ? this.expenseService.update(editingId, payload) : this.expenseService.create(payload);
  }

  private filterMovements(movements: Movement[], filters: MovementFilters): Movement[] {
    return movements.filter((movement) => this.movementMatchesFilters(movement, filters));
  }

  private movementMatchesFilters(movement: Movement, filters: MovementFilters): boolean {
    if (!this.matchesPeriod(movement.date, filters.periodId)) {
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

  /**
   * Compara la fecha del movimiento contra el rango [startDate, endDate]
   * del periodo seleccionado, la misma comparacion que hace PostgreSQL
   * en period.model.ts (BETWEEN) para calcular los totales de un
   * periodo. "todos" no filtra por periodo.
   */
  private matchesPeriod(movementDate: string, periodId: string): boolean {
    if (periodId === "todos") {
      return true;
    }

    const period = this.periods().find((candidate) => candidate.id === periodId);
    if (!period) {
      return true;
    }

    return movementDate >= period.startDate && movementDate <= period.endDate;
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.formType.set("ingreso");
    this.form.reset({ description: "", amount: "", category: "", date: "" });
    this.isSubmitting.set(false);
  }

  private loadAll(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      incomes: this.incomeService.list(),
      expenses: this.expenseService.list(),
      periods: this.periodService.list(),
    }).subscribe({
      next: ({ incomes, expenses, periods }) => {
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
          return a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0;
        });

        this.allMovements.set(combined);
        this.periods.set(periods.periods);

        // Por defecto, la primera vez que carga la vista, si hay un
        // periodo activo, se filtra por ese periodo (igual que "Este
        // periodo" en la maqueta); si no hay ninguno activo, se
        // muestran todos los movimientos. Las cargas posteriores no
        // vuelven a tocar el filtro para no pisar lo que el usuario ya
        // haya elegido.
        if (!this.hasAppliedDefaultPeriod) {
          this.hasAppliedDefaultPeriod = true;
          const active = periods.periods.find((period) => period.status === "activo");
          if (active) {
            this.draftFilters.set({ ...this.draftFilters(), periodId: active.id });
            this.appliedFilters.set({ ...this.appliedFilters(), periodId: active.id });
          }
        }

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

    if (error.status === 404) {
      return "El movimiento ya no existe (es posible que se haya eliminado desde otra sesion).";
    }

    const body = error.error as { message?: string } | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrió un error inesperado. Intente nuevamente.";
  }
}
