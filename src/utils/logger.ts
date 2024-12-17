export function logError(action: string, error: unknown) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const status = error instanceof Error ? "❌ error" : "💥 fatal";
  const message =
    error instanceof Error ? error.message : JSON.stringify(error);

  console.error(
    `[${timestamp}] ${status}: ⚠️ ${action} - ${message}\n  ↳ Stack:\n${
      error instanceof Error ? error.stack : "N/A"
    }`
  );
}
