import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { ObjectiveService } from "../../core/services/objective.service";
import { PeriodService } from "../../core/services/period.service";
import {
  CreateObjectiveRequest,
  Objective,
  ObjectiveCategory,
  ObjectiveStatus,
} from "../../core/models/objective.models";
import { Period } from "../../core/models/period.models";
import { formatQuetzales } from "../../shared/utils/format-currency";

const PAGE_SIZE = 8;

type StatusFilter = "todos" | ObjectiveStatus;
type CategoryFilter = "todos" | ObjectiveCategory;
type PeriodFilter = "todos" | string;

interface ObjectiveFilters {
  search: string;
  status: StatusFilter;
  category: CategoryFilter;
  periodId: PeriodFilter;
}

const DEFAULT_FILTERS: ObjectiveFilters = {
  search: "",
  status: "todos",
  category: "todos",
  periodId: "todos",
};

// Fila ya formateada para mostrar en la tabla (montos con "Q", fecha
// limite en dd/mm/aaaa). El porcentaje de progreso NO se recalcula aqui:
// llega tal cual desde el backend (ver objective.service.ts), para no
// duplicar en el frontend una regla de negocio que ya vive del lado del
// servidor.
interface ObjectiveRow {
  id: string;
  name: string;
  description: string;
  category: ObjectiveCategory;
  periodName: string;
  targetAmountLabel: string;
  currentAmountLabel: string;
  progressPercentage: number;
  status: ObjectiveStatus;
  raw: Objective;
}

/**
 * Seccion "Objetivos", conectada a la API real (backend + PostgreSQL).
 * Sigue el mismo patron visual y de estados (carga, error, vacio, sin
 * resultados) que Periodos y Movimientos. El progreso de cada objetivo y
 * los totales de las tarjetas de resumen se calculan a partir de datos
 * reales: el porcentaje de avance lo entrega ya calculado el backend, y
 * aqui unicamente se formatea para mostrarlo (nunca se usa "Math" en la
 * plantilla).
 */
@Component({
  selector: "app-objectives",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./objectives.component.html",
  styleUrl: "./objectives.component.scss",
})
export class ObjectivesComponent implements OnInit {
  private readonly objectiveService = inject(ObjectiveService);
  private readonly periodService = inject(PeriodService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  private readonly objectives = signal<Objective[]>([]);
  readonly periods = signal<Period[]>([]);

  readonly filters = signal<ObjectiveFilters>({ ...DEFAULT_FILTERS });
  readonly currentPage = signal(1);

  readonly categoryOptions: { value: ObjectiveCategory; label: string }[] = [
    { value: "Ahorro", label: "Ahorro" },
    { value: "Educacion", label: "Educación" },
    { value: "Compra", label: "Compra" },
    { value: "Inversion", label: "Inversión" },
    { value: "Otros", label: "Otros" },
  ];

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "no_iniciado", label: "No iniciado" },
    { value: "en_progreso", label: "En progreso" },
    { value: "cumplido", label: "Cumplido" },
  ];

  readonly hasActiveFilters = computed(() => {
    const current = this.filters();
    return (
      current.search.trim() !== "" ||
      current.status !== "todos" ||
      current.category !== "todos" ||
      current.periodId !== "todos"
    );
  });

  // ============ Tarjetas de resumen ============

  readonly totalObjectivesCount = computed(() => this.objectives().length);

  readonly activeObjectivesCount = computed(
    () => this.objectives().filter((objective) => objective.status === "en_progreso").length
  );

  readonly completedObjectivesCount = computed(
    () => this.objectives().filter((objective) => objective.status === "cumplido").length
  );

  readonly totalSavedLabel = computed(() => {
    const total = this.objectives().reduce(
      (sum, objective) => sum + Number(objective.currentAmount),
      0
    );
    return formatQuetzales(total);
  });

  // ============ Filtros + tabla ============

  readonly filteredObjectives = computed<Objective[]>(() => {
    const current = this.filters();
    const term = current.search.trim().toLowerCase();

    return this.objectives().filter((objective) => {
      if (current.status !== "todos" && objective.status !== current.status) {
        return false;
      }
      if (current.category !== "todos" && objective.category !== current.category) {
        return false;
      }
      if (current.periodId !== "todos" && objective.periodId !== current.periodId) {
        return false;
      }
      if (term && !objective.name.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  });

  readonly totalCount = computed(() => this.filteredObjectives().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  readonly pagedRows = computed<ObjectiveRow[]>(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    return this.filteredObjectives()
      .slice(start, start + PAGE_SIZE)
      .map((objective) => this.toRow(objective));
  });

  readonly rangeStart = computed(() =>
    this.totalCount() === 0 ? 0 : (this.currentPage() - 1) * PAGE_SIZE + 1
  );
  readonly rangeEnd = computed(() => Math.min(this.currentPage() * PAGE_SIZE, this.totalCount()));

  // ============ Modal de detalle (solo lectura) ============

  readonly selectedObjective = signal<Objective | null>(null);

  // ============ Modal de crear / editar ============

  readonly isFormOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);

  readonly form = this.formBuilder.group({
    periodId: ["", [Validators.required]],
    name: ["", [Validators.required, Validators.maxLength(120)]],
    description: ["", [Validators.maxLength(255)]],
    category: ["Ahorro" as ObjectiveCategory, [Validators.required]],
    targetAmount: [0, [Validators.required, Validators.min(0.01)]],
    currentAmount: [0, [Validators.min(0)]],
    deadline: [""],
  });

  // ============ Modal de progreso ============

  readonly isProgressModalOpen = signal(false);
  readonly isSubmittingProgress = signal(false);
  readonly progressError = signal<string | null>(null);
  readonly progressTarget = signal<Objective | null>(null);

  readonly progressForm = this.formBuilder.group({
    currentAmount: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadPeriods();
    this.loadObjectives();
  }

  updateFilter<K extends keyof ObjectiveFilters>(key: K, value: ObjectiveFilters[K]): void {
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

  viewDetail(row: ObjectiveRow): void {
    this.selectedObjective.set(row.raw);
  }

  closeDetail(): void {
    this.selectedObjective.set(null);
  }

  // ============ Crear / editar ============

  openCreateModal(): void {
    if (this.periods().length === 0) {
      this.actionError.set("Debes crear al menos un periodo antes de registrar un objetivo.");
      return;
    }

    this.actionError.set(null);
    this.formError.set(null);
    this.editingId.set(null);
    this.form.reset({
      periodId: this.periods()[0].id,
      name: "",
      description: "",
      category: "Ahorro",
      targetAmount: 0,
      currentAmount: 0,
      deadline: "",
    });
    this.isFormOpen.set(true);
  }

  startEdit(row: ObjectiveRow): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.editingId.set(row.id);
    this.form.reset({
      periodId: row.raw.periodId,
      name: row.raw.name,
      description: row.raw.description,
      category: row.raw.category,
      targetAmount: Number(row.raw.targetAmount),
      currentAmount: Number(row.raw.currentAmount),
      deadline: row.raw.deadline ?? "",
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

    const { periodId, name, description, category, targetAmount, currentAmount, deadline } =
      this.form.getRawValue();

    const payload: CreateObjectiveRequest = {
      periodId,
      name,
      description,
      category,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount),
      deadline: deadline ? deadline : null,
    };

    const editingId = this.editingId();

    const request$ = editingId
      ? this.objectiveService.update(editingId, payload)
      : this.objectiveService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isFormOpen.set(false);
        this.successMessage.set(
          editingId ? "Objetivo actualizado correctamente." : "Objetivo creado correctamente."
        );
        this.loadObjectives();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.formError.set(this.resolveErrorMessage(error));
      },
    });
  }

  // ============ Registrar / actualizar progreso ============

  openProgressModal(row: ObjectiveRow): void {
    this.actionError.set(null);
    this.progressError.set(null);
    this.progressTarget.set(row.raw);
    this.progressForm.reset({ currentAmount: Number(row.raw.currentAmount) });
    this.isProgressModalOpen.set(true);
  }

  closeProgressModal(): void {
    this.isProgressModalOpen.set(false);
    this.isSubmittingProgress.set(false);
    this.progressTarget.set(null);
  }

  submitProgress(): void {
    const target = this.progressTarget();
    if (!target || this.progressForm.invalid || this.isSubmittingProgress()) {
      this.progressForm.markAllAsTouched();
      return;
    }

    this.progressError.set(null);
    this.isSubmittingProgress.set(true);

    const { currentAmount } = this.progressForm.getRawValue();

    this.objectiveService.updateProgress(target.id, { currentAmount: Number(currentAmount) }).subscribe({
      next: () => {
        this.isSubmittingProgress.set(false);
        this.isProgressModalOpen.set(false);
        this.progressTarget.set(null);
        this.successMessage.set("Progreso actualizado correctamente.");
        this.loadObjectives();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmittingProgress.set(false);
        this.progressError.set(this.resolveErrorMessage(error));
      },
    });
  }

  // ============ Eliminar ============

  confirmDelete(row: ObjectiveRow): void {
    const confirmed = window.confirm(`¿Confirma que desea eliminar el objetivo "${row.name}"?`);

    if (!confirmed) {
      return;
    }

    this.actionError.set(null);

    this.objectiveService.delete(row.id).subscribe({
      next: () => {
        this.loadObjectives();
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(this.resolveErrorMessage(error));
      },
    });
  }

  // ============ Utilidades de formato ============

  formatAmount(value: string | number): string {
    return formatQuetzales(value);
  }

  formatDateLabel(isoDate: string | null): string {
    if (!isoDate) {
      return "Sin fecha límite";
    }
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  categoryLabel(category: ObjectiveCategory): string {
    return this.categoryOptions.find((option) => option.value === category)?.label ?? category;
  }

  statusLabel(status: ObjectiveStatus): string {
    switch (status) {
      case "cumplido":
        return "Cumplido";
      case "en_progreso":
        return "En progreso";
      default:
        return "No iniciado";
    }
  }

  private toRow(objective: Objective): ObjectiveRow {
    return {
      id: objective.id,
      name: objective.name,
      description: objective.description,
      category: objective.category,
      periodName: objective.periodName,
      targetAmountLabel: formatQuetzales(objective.targetAmount),
      currentAmountLabel: formatQuetzales(objective.currentAmount),
      progressPercentage: objective.progressPercentage,
      status: objective.status,
      raw: objective,
    };
  }

  private loadPeriods(): void {
    this.periodService.list().subscribe({
      next: ({ periods }) => {
        this.periods.set(periods);
      },
      error: () => {
        // El filtro y el formulario simplemente quedan sin opciones de
        // periodo; el error principal de carga ya lo reporta loadObjectives().
      },
    });
  }

  private loadObjectives(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.objectiveService.list().subscribe({
      next: ({ objectives }) => {
        this.objectives.set(objectives);
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
      return "El objetivo ya no existe (es posible que se haya eliminado desde otra sesion).";
    }

    const body = error.error as { message?: string } | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrió un error inesperado. Intente nuevamente.";
  }
}
