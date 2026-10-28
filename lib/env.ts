function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get GEMINI_API_KEY() {
    return required("GEMINI_API_KEY");
  },
  get APP_PASSWORD() {
    return required("APP_PASSWORD");
  },
  get SESSION_SECRET() {
    return required("SESSION_SECRET");
  },
  get CRON_SECRET() {
    return process.env.CRON_SECRET ?? "";
  },
};
