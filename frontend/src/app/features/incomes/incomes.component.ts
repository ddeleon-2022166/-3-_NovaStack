import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin } from "rxjs";
import { IncomeService } from "../../core/services/income.service";
import { CreateIncomeRequest, INCOME_CATEGORIES, Income } from "../../core/models/income.models";
import { formatQuetzales } from "../../shared/utils/format-currency";
import {
  formatDateOnlyLabel,
  parseDateOnly,
  toDateOnlyIso,
  todayDateOnlyIso,
} from "../../shared/utils/date-only.util";

// Fila ya formateada para mostrar en la tabla (fecha en dd/mm/aaaa,
// monto con separador de miles y "Q").
interface IncomeRow {
  id: string;
  dateLabel: string;
  description: string;
  category: string;
  amountLabel: string;
  raw: Income;
}

// La columna "amount" en PostgreSQL es NUMERIC(12, 2): hasta 10 digitos
// enteros y 2 decimales. Este es el valor real maximo que la base de
// datos puede almacenar (mismo limite que valida el backend).
const MAX_AMOUNT = 9999999999.99;
const AMOUNT_DECIMALS_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Valida el campo "monto" con un unico control, para poder mostrar un
 * mensaje especifico segun cual sea el problema (obligatorio, invalido,
 * cero/negativo, mas de dos decimales, o supera el maximo permitido)
 * en vez de un solo mensaje generico.
 */
function amountValidator(control: AbstractControl): ValidationErrors | null {
  const rawValue = control.value;

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return { amountRequired: true };
  }

  const numericValue = Number(rawValue);

  if (typeof rawValue !== "number" && typeof rawValue !== "string") {
    return { amountInvalid: true };
  }

  if (Number.isNaN(numericValue) || !Number.isFinite(numericValue)) {
    return { amountInvalid: true };
  }

  if (numericValue <= 0) {
    return { amountNotPositive: true };
  }

  if (!AMOUNT_DECIMALS_REGEX.test(String(rawValue).trim())) {
    return { amountDecimals: true };
  }

  if (numericValue > MAX_AMOUNT) {
    return { amountTooLarge: true };
  }

  return null;
}

/**
 * Seccion "Ingresos", conectada a la API real (backend + PostgreSQL).
 * El formulario tambien sirve para editar un registro existente, y la
 * tabla permite eliminar registros (mismo patron que Egresos).
 */
@Component({
  selector: "app-incomes",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./incomes.component.html",
  styleUrl: "./incomes.component.scss",
})
export class IncomesComponent implements OnInit {
  private readonly incomeService = inject(IncomeService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly categories = INCOME_CATEGORIES;

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  private readonly incomes = signal<Income[]>([]);
  private readonly totalAmount = signal<string>("0");

  readonly totalFormatted = computed(() => formatQuetzales(this.totalAmount()));

  readonly tableRows = computed<IncomeRow[]>(() =>
    this.incomes().map((income) => ({
      id: income.id,
      dateLabel: this.formatDateLabel(income.incomeDate),
      description: income.description,
      category: income.category,
      amountLabel: formatQuetzales(income.amount),
      raw: income,
    }))
  );

  readonly hasIncomes = computed(() => this.tableRows().length > 0);

  // Si tiene valor, el formulario esta editando ese ingreso en vez de
  // crear uno nuevo (cambia el texto del boton y aparece "Cancelar").
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);

  // Fecha seleccionada en el "stepper" del formulario (por defecto, hoy).
  // Ingresos y Egresos no permiten registrar fechas futuras (Periodos si
  // puede, por eso este limite vive unicamente aqui).
  private readonly selectedDate = signal(new Date());
  readonly selectedDateLabel = computed(() =>
    this.formatDateLabel(toDateOnlyIso(this.selectedDate()))
  );

  // La fecha maxima seleccionable es "hoy", segun la fecha local del
  // usuario. Se recalcula en cada acceso (en vez de guardarse una sola
  // vez) para que una sesion abierta a medianoche no quede desfasada.
  private get maxSelectableDate(): Date {
    return parseDateOnly(todayDateOnlyIso());
  }

  // Controla cuando deshabilitar « y › en el stepper de fecha.
  readonly isAtMaxDate = computed(() => toDateOnlyIso(this.selectedDate()) >= todayDateOnlyIso());
  readonly isNextMonthDisabled = computed(() => {
    const current = this.selectedDate();
    const today = new Date();
    return current.getFullYear() === today.getFullYear() && current.getMonth() === today.getMonth();
  });

  readonly form = this.formBuilder.group({
    description: ["", [Validators.required, Validators.maxLength(255)]],
    amount: ["", [amountValidator]],
    category: ["", [Validators.required]],
  });

  ngOnInit(): void {
    this.loadIncomes();
  }

  /**
   * Mueve la fecha seleccionada por dia (‹ ›) o por mes (« »). Nunca
   * permite avanzar mas alla del dia de hoy: si el paso llegara a una
   * fecha futura, se ajusta directamente a hoy.
   */
  stepDate(unit: "day" | "month", delta: number): void {
    this.selectedDate.update((current) => {
      const next = new Date(current);
      if (unit === "day") {
        next.setDate(next.getDate() + delta);
      } else {
        next.setMonth(next.getMonth() + delta);
      }

      const max = this.maxSelectableDate;
      return next > max ? max : next;
    });
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { description, amount, category } = this.form.getRawValue();

    const payload: CreateIncomeRequest = {
      description,
      amount: Number(amount),
      category,
      incomeDate: toDateOnlyIso(this.selectedDate()),
    };

    const editingId = this.editingId();
    const request$ = editingId
      ? this.incomeService.update(editingId, payload)
      : this.incomeService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set(
          editingId ? "Ingreso actualizado correctamente." : "Ingreso registrado correctamente."
        );
        this.resetForm();
        this.loadIncomes();

        // El mensaje de confirmacion es breve: se oculta solo despues de un momento.
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  /** Carga un ingreso existente en el formulario para editarlo. */
  startEdit(row: IncomeRow): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editingId.set(row.id);

    this.form.setValue({
      description: row.raw.description,
      amount: row.raw.amount,
      category: row.raw.category,
    });

    this.selectedDate.set(parseDateOnly(row.raw.incomeDate));
  }

  /** Cancela la edicion en curso y deja el formulario listo para un registro nuevo. */
  cancelEdit(): void {
    this.resetForm();
  }

  /** Pide confirmacion y, si el usuario acepta, elimina el ingreso mediante la API. */
  confirmDelete(row: IncomeRow): void {
    const confirmed = window.confirm(
      `¿Confirma que desea eliminar el ingreso "${row.description}" por ${row.amountLabel}?`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage.set(null);

    this.incomeService.delete(row.id).subscribe({
      next: () => {
        if (this.editingId() === row.id) {
          this.resetForm();
        }
        this.loadIncomes();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  /** Vuelve a consultar la lista y el resumen desde el backend. */
  private loadIncomes(): void {
    this.isLoading.set(true);

    forkJoin({
      list: this.incomeService.list(),
      summary: this.incomeService.summary(),
    }).subscribe({
      next: ({ list, summary }) => {
        this.incomes.set(list.incomes);
        this.totalAmount.set(summary.total);
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

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({ description: "", amount: "", category: "" });
    this.selectedDate.set(new Date());
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "No fue posible conectarse con el servidor. Intente nuevamente.";
    }

    if (error.status === 404) {
      return "El ingreso ya no existe (es posible que se haya eliminado desde otra sesion).";
    }

    const body = error.error as { message?: string } | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrio un error inesperado. Intente nuevamente.";
  }

  private formatDateLabel(isoDate: string): string {
    return formatDateOnlyLabel(isoDate);
  }

  /**
   * Mensaje de error especifico para el campo "monto", segun cual haya
   * sido el problema detectado por amountValidator. Se evalua en orden
   * (obligatorio primero) para nunca mostrar "es obligatorio" cuando en
   * realidad el problema es otro.
   */
  amountErrorMessage(): string {
    const errors = this.form.controls.amount.errors;

    if (!errors) {
      return "";
    }

    if (errors["amountRequired"]) {
      return "El monto es obligatorio";
    }

    if (errors["amountInvalid"]) {
      return "Ingrese un monto válido";
    }

    if (errors["amountNotPositive"]) {
      return "El monto debe ser mayor que cero";
    }

    if (errors["amountDecimals"]) {
      return "El monto solo puede tener dos decimales";
    }

    if (errors["amountTooLarge"]) {
      return "El monto supera el valor máximo permitido";
    }

    return "";
  }
}
