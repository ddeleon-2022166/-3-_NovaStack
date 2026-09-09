// Entorno de desarrollo local, usado por "ng serve".
export const environment = {
  production: false,
  apiUrl: "http://localhost:3000/api",
  // Client ID publico de Google OAuth (no es un secreto: se expone en el
  // navegador de forma segura). Debe coincidir con GOOGLE_CLIENT_ID del backend.
  googleClientId: "",
};
