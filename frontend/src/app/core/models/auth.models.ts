// Datos que el usuario ingresa en el formulario de login
export interface LoginCredentials {
  email: string;
  password: string;
}

// Datos publicos del usuario autenticado (nunca incluye la contrasena)
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  // Solo presente para cuentas vinculadas con Google
  profilePicture?: string;
}

// Forma de la respuesta exitosa del backend en POST /api/auth/login
export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

// Forma de la respuesta exitosa del backend en POST /api/auth/google
// (identica a la del login tradicional, para que el frontend la trate igual)
export type GoogleLoginResponse = LoginResponse;

// Forma de la respuesta del backend en GET /api/auth/me
export interface MeResponse {
  user: AuthUser;
}

// Forma generica de un error devuelto por la API
export interface ApiErrorResponse {
  message: string;
}
