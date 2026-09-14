import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";

export const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  {
    path: "login",
    loadComponent: () =>
      import("./features/auth/login/login.component").then((m) => m.LoginComponent),
  },
  {
    // Layout compartido (barra lateral + barra superior) para toda el
    // area autenticada. El guard se aplica una sola vez aqui y protege
    // por igual a todas las rutas hijas (Dashboard, Ingresos, y las que
    // se agreguen despues).
    path: "",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./shared/dashboard-shell/dashboard-shell.component").then(
        (m) => m.DashboardShellComponent
      ),
    children: [
      {
        path: "dashboard",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then((m) => m.DashboardComponent),
      },
      {
        path: "ingresos",
        loadComponent: () =>
          import("./features/incomes/incomes.component").then((m) => m.IncomesComponent),
      },
      {
        path: "egresos",
        loadComponent: () =>
          import("./features/expenses/expenses.component").then((m) => m.ExpensesComponent),
      },
      {
        path: "historial",
        loadComponent: () =>
          import("./features/history/history.component").then((m) => m.HistoryComponent),
      },
      {
        path: "periodos",
        loadComponent: () =>
          import("./features/periods/periods.component").then((m) => m.PeriodsComponent),
      },
      {
        path: "movimientos",
        loadComponent: () =>
          import("./features/movements/movements.component").then((m) => m.MovementsComponent),
      },
      {
        path: "objetivos",
        loadComponent: () =>
          import("./features/objectives/objectives.component").then(
            (m) => m.ObjectivesComponent
          ),
      },
    ],
  },
  { path: "**", redirectTo: "login" },
];
