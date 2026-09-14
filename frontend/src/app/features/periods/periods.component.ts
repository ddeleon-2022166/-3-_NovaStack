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
import { PeriodService } from "../../core/services/period.service";
import { CreatePeriodRequest, Period, PeriodStatus } from "../../core/models/period.models";
import { formatQuetzales } from "../../shared/utils/format-currency";

const PAGE_SIZE = 8;

type StatusFilter = "todos" | PeriodStatus;
type SortOption = "reciente" | "antiguo";

interface PeriodFilters {
  search: string;
  status: StatusFilter;
  sort: SortOption;
}

const DEFAULT_FILTERS: PeriodFilters = {
  search: "",
  status: "todos",
  sort: "reciente",
};

// Fila ya formateada para mostrar en la tabla (fechas en dd/mm/aaaa,
// montos con separador de miles y "Q", cantidad de dias calculada).
interface PeriodRow {
  id: string;
  name: string;
  startLabel: string;
  endLabel: string;
  daysCount: number;
  status: PeriodStatus;
  totalIncomeLabel: string;
  totalExpenseLabel: string;
  balanceLabel: string;
  raw: Period;
}

/** Valida que la fecha final no sea anterior a la fecha inicial. */
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const startDate = group.get("startDate")?.value;
  const endDate = group.get("endDate")?.value;
  if (startDate && endDate && endDate < startDate) {
    return { dateRange: true };
  }
  return null;
}

/**
 * Seccion "Periodos", conectada a la API real (backend + PostgreSQL).
 * Sigue el mismo patron visual y de estados (carga, error, vacio, sin
 * resultados) que Historial e Ingresos. Los totales de cada periodo
 * (ingresos, egresos, balance) los calcula el backend comparando el
 * rango de fechas del periodo contra los ingresos y egresos reales del
 * usuario autenticado.
 */
@Component({
  selector: "app-periods",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./periods.component.html",
  styleUrl: "./periods.component.scss",
})
export class PeriodsComponent implements OnInit {
  private readonly periodService = inject(PeriodService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  private readonly periods = signal<Period[]>([]);

  readonly filters = signal<PeriodFilters>({ ...DEFAULT_FILTERS });
  readonly currentPage = signal(1);

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "activo", label: "Activo" },
    { value: "cerrado", label: "Cerrado" },
    { value: "planificado", label: "Planificado" },
  ];

  readonly sortOptions: { value: SortOption; label: string }[] = [
    { value: "reciente", label: "Más reciente" },
    { value: "antiguo", label: "Más antiguo" },
  ];

  readonly hasActiveFilters = computed(() => {
    const current = this.filters();
    return (
      current.search.trim() !== "" || current.status !== "todos" || current.sort !== "reciente"
    );
  });

  // ============ Tarjetas de resumen ============

  readonly activePeriod = computed<Period | null>(
    () => this.periods().find((period) => period.status === "activo") ?? null
  );

  readonly totalPeriodsCount = computed(() => this.periods().length);

  readonly activePeriodDaysElapsed = computed(() => {
    const active = this.activePeriod();
    if (!active) {
      return 0;
    }
    const totalDays = this.daysBetweenInclusive(active.startDate, active.endDate);
    const elapsedFromStart = this.daysBetweenInclusive(active.startDate, this.todayIso());
    return Math.min(Math.max(elapsedFromStart, 0), totalDays);
  });

  readonly activePeriodTotalDays = computed(() => {
    const active = this.activePeriod();
    return active ? this.daysBetweenInclusive(active.startDate, active.endDate) : 0;
  });

  readonly activePeriodBalanceLabel = computed(() => {
    const active = this.activePeriod();
    return formatQuetzales(active ? active.balance : 0);
  });

  // ============ Filtros + tabla ============

  readonly filteredPeriods = computed<Period[]>(() => {
    const current = this.filters();
    const term = current.search.trim().toLowerCase();

    const filtered = this.periods().filter((period) => {
      if (current.status !== "todos" && period.status !== current.status) {
        return false;
      }
      if (term && !period.name.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (a.startDate === b.startDate) {
        return 0;
      }
      const isMoreRecentFirst = current.sort === "reciente";
      if (isMoreRecentFirst) {
        return a.startDate > b.startDate ? -1 : 1;
      }
      return a.startDate < b.startDate ? -1 : 1;
    });
  });

  readonly totalCount = computed(() => this.filteredPeriods().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  readonly pagedRows = computed<PeriodRow[]>(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    return this.filteredPeriods()
      .slice(start, start + PAGE_SIZE)
      .map((period) => this.toRow(period));
  });

  readonly rangeStart = computed(() =>
    this.totalCount() === 0 ? 0 : (this.currentPage() - 1) * PAGE_SIZE + 1
  );
  readonly rangeEnd = computed(() => Math.min(this.currentPage() * PAGE_SIZE, this.totalCount()));

  // ============ Modal de detalle (solo lectura) ============

  readonly selectedPeriod = signal<Period | null>(null);

  // ============ Modal de crear / editar ============

  readonly isFormOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);

  readonly form = this.formBuilder.group(
    {
      name: ["", [Validators.required, Validators.maxLength(120)]],
      startDate: ["", [Validators.required]],
      endDate: ["", [Validators.required]],
      status: ["planificado" as PeriodStatus, [Validators.required]],
    },
    { validators: dateRangeValidator }
  );

  ngOnInit(): void {
    this.loadPeriods();
  }

  updateFilter<K extends keyof PeriodFilters>(key: K, value: PeriodFilters[K]): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  // ============ Detalle ============

  viewDetail(row: PeriodRow): void {
    this.selectedPeriod.set(row.raw);
  }

  closeDetail(): void {
    this.selectedPeriod.set(null);
  }

  // ============ Crear / editar ============

  openCreateModal(): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.editingId.set(null);
    this.form.reset({ name: "", startDate: "", endDate: "", status: "planificado" });
    this.isFormOpen.set(true);
  }

  startEdit(row: PeriodRow): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.editingId.set(row.id);
    this.form.reset({
      name: row.raw.name,
      startDate: row.raw.startDate,
      endDate: row.raw.endDate,
      status: row.raw.status,
    });
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.isSubmitting.set(false);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.formError.set(null);
    this.isSubmitting.set(true);

    const { name, startDate, endDate, status } = this.form.getRawValue();
    const payload: CreatePeriodRequest = { name, startDate, endDate, status };
    const editingId = this.editingId();

    const request$ = editingId
      ? this.periodService.update(editingId, payload)
      : this.periodService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isFormOpen.set(false);
        this.successMessage.set(
          editingId ? "Periodo actualizado correctamente." : "Periodo creado correctamente."
        );
        this.loadPeriods();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.formError.set(this.resolveErrorMessage(error));
      },
    });
  }

  // ============ Activar / eliminar ============

  setActive(row: PeriodRow): void {
    if (row.status === "activo") {
      return;
    }

    this.actionError.set(null);

    this.periodService.activate(row.id).subscribe({
      next: () => {
        this.successMessage.set(`"${row.name}" ahora es el periodo activo.`);
        this.loadPeriods();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(this.resolveErrorMessage(error));
      },
    });
  }

  confirmDelete(row: PeriodRow): void {
    const confirmed = window.confirm(`¿Confirma que desea eliminar el periodo "${row.name}"?`);

    if (!confirmed) {
      return;
    }

    this.actionError.set(null);

    this.periodService.delete(row.id).subscribe({
      next: () => {
        this.loadPeriods();
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(this.resolveErrorMessage(error));
      },
    });
  }

  // ============ Utilidades de formato ============

  formatAmount(value: string): string {
    return formatQuetzales(value);
  }

  formatDateLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  statusLabel(status: PeriodStatus): string {
    switch (status) {
      case "activo":
        return "Activo";
      case "cerrado":
        return "Cerrado";
      default:
        return "Planificado";
    }
  }

  private toRow(period: Period): PeriodRow {
    return {
      id: period.id,
      name: period.name,
      startLabel: this.formatDateLabel(period.startDate),
      endLabel: this.formatDateLabel(period.endDate),
      daysCount: this.daysBetweenInclusive(period.startDate, period.endDate),
      status: period.status,
      totalIncomeLabel: formatQuetzales(period.totalIncome),
      totalExpenseLabel: formatQuetzales(period.totalExpense),
      balanceLabel: formatQuetzales(period.balance),
      raw: period,
    };
  }

  private daysBetweenInclusive(startIso: string, endIso: string): number {
    const start = new Date(`${startIso}T00:00:00Z`);
    const end = new Date(`${endIso}T00:00:00Z`);
    const diffMs = end.getTime() - start.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  private todayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private loadPeriods(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.periodService.list().subscribe({
      next: ({ periods }) => {
        this.periods.set(periods);
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
      return "El periodo ya no existe (es posible que se haya eliminado desde otra sesion).";
    }

    const body = error.error as { message?: string } | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrió un error inesperado. Intente nuevamente.";
  }
}
