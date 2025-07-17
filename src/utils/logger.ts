import winston from "winston";

// Emoji mapping for log levels
const levelEmojis: { [key: string]: string } = {
  info: "ℹ️",
  error: "❌",
  fatal: "💀",
  warn: "⚠️",
  debug: "✏️",
};

// Winston logger configuration with timestamp and emoji formatting
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "DD/MM/YYYY HH:mm:ss",
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      const emoji = levelEmojis[level] || "";
      return `${timestamp} ${emoji} ${level} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Log a message with a given level, action, and optional stack trace
export function logMessage(
  level: string,
  action: string,
  message: string,
  stack?: string
) {
  const logMessage = `${action} - ${message}${
    stack ? `\n  ↳ Stack:\n${stack}` : ""
  }`;
  logger.log({ level, message: logMessage });
}

// Log an error or fatal event with details and stack trace
export function logError(action: string, error: unknown, source?: string) {
  const status = error instanceof Error ? "error" : "fatal";
  const message =
    error instanceof Error ? error.message : JSON.stringify(error);
  const stack = error instanceof Error ? error.stack : "N/A";
  const name = error instanceof Error ? error.name : "UnknownError";
  const sourceInfo = source ? `Source: ${source}\n` : "";
  const formattedMessage = `${sourceInfo}Name: ${name}\nMessage: ${message}\nStack:\n${stack}`;
  logMessage(status, action, formattedMessage);
}

// Log an informational message
export function logInfo(action: string, message: string) {
  logMessage("info", action, message);
}

// Retry a function several times with delay between attempts
export async function retry(
  fn: () => Promise<void>,
  retries = 3,
  delay = 300000
) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (error) {
      if (i < retries - 1) {
        logInfo(
          "retry",
          `Retry ${i + 1}/${retries} due to error: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logError("retry", error);
        throw error;
      }
    }
  }
}
