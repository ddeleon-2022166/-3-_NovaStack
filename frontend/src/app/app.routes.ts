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
    path: "bienvenida",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/welcome/welcome.component").then((m) => m.WelcomeComponent),
  },
  { path: "**", redirectTo: "login" },
];
