// Entorno de produccion. Ajusta apiUrl si el backend se despliega en otra direccion.
export const environment = {
  production: true,
  apiUrl: "http://localhost:3000/api",
  // Client ID publico de Google OAuth (no es un secreto: se expone en el
  // navegador de forma segura). Debe coincidir con GOOGLE_CLIENT_ID del backend.
  googleClientId: "",
};
