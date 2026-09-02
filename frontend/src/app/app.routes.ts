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
    ],
  },
  { path: "**", redirectTo: "login" },
];
