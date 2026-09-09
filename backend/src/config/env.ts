import dotenv from "dotenv";
import path from "path";

// Carga el archivo .env ubicado en la raiz de "backend"
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

interface EnvConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  google: {
    clientId: string;
  };
}

function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(
      `La variable de entorno "${name}" es obligatoria y no fue definida. Revisa tu archivo .env`
    );
  }
  return value;
}

export const env: EnvConfig = {
  port: Number(getEnvVar("PORT", "3000")),
  nodeEnv: getEnvVar("NODE_ENV", "development"),
  frontendUrl: getEnvVar("FRONTEND_URL", "http://localhost:4200"),
  db: {
    host: getEnvVar("DB_HOST", "localhost"),
    port: Number(getEnvVar("DB_PORT", "5432")),
    name: getEnvVar("DB_NAME", "control_de_gastos"),
    user: getEnvVar("DB_USER", "postgres"),
    password: getEnvVar("DB_PASSWORD", "postgres"),
  },
  jwt: {
    secret: getEnvVar("JWT_SECRET"),
    expiresIn: getEnvVar("JWT_EXPIRES_IN", "1h"),
  },
  // Opcional: si no se define, el login tradicional sigue funcionando con
  // normalidad; unicamente el endpoint POST /api/auth/google respondera
  // con un error controlado indicando que falta configuracion.
  google: {
    clientId: getEnvVar("GOOGLE_CLIENT_ID", ""),
  },
};
