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

// Fila ya formateada para mostrar en la tabla (fecha en dd/mm/aaaa,
// monto con separador de miles y "Q").
interface IncomeRow {
  id: string;
  dateLabel: string;
  description: string;
  category: string;
  amountLabel: string;
}

/** Valida que el monto ingresado sea un numero mayor que cero. */
function positiveAmountValidator(control: AbstractControl): ValidationErrors | null {
  const numericValue = Number(control.value);
  if (control.value === "" || !Number.isFinite(numericValue) || numericValue <= 0) {
    return { positiveAmount: true };
  }
  return null;
}

/**
 * Seccion "Ingresos", conectada a la API real (backend + PostgreSQL).
 * El formulario registra un ingreso nuevo; la tabla y la tarjeta de
 * total siempre reflejan lo que realmente existe en la base de datos
 * para el usuario autenticado.
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
    }))
  );

  readonly hasIncomes = computed(() => this.tableRows().length > 0);

  // Fecha seleccionada en el "stepper" del formulario (por defecto, hoy).
  private readonly selectedDate = signal(new Date());
  readonly selectedDateLabel = computed(() =>
    this.formatDateLabel(this.toIsoDate(this.selectedDate()))
  );

  readonly form = this.formBuilder.group({
    description: ["", [Validators.required, Validators.maxLength(255)]],
    amount: ["", [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/), positiveAmountValidator]],
    category: ["", [Validators.required]],
  });

  ngOnInit(): void {
    this.loadIncomes();
  }

  /** Mueve la fecha seleccionada por dia (‹ ›) o por mes (« »). */
  stepDate(unit: "day" | "month", delta: number): void {
    this.selectedDate.update((current) => {
      const next = new Date(current);
      if (unit === "day") {
        next.setDate(next.getDate() + delta);
      } else {
        next.setMonth(next.getMonth() + delta);
      }
      return next;
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
      incomeDate: this.toIsoDate(this.selectedDate()),
    };

    this.incomeService.create(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set("Ingreso registrado correctamente.");
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
    this.form.reset({ description: "", amount: "", category: "" });
    this.selectedDate.set(new Date());
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "No fue posible conectarse con el servidor. Intenta nuevamente.";
    }

    const body = error.error as { message?: string } | undefined;
    if (body?.message) {
      return body.message;
    }

    return "Ocurrio un error inesperado. Intenta nuevamente.";
  }

  private formatDateLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
