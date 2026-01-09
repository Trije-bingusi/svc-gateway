import pino from "pino";
import pinoHttp from "pino-http";

// Ensure log level is a string (info, error, etc.) instead of Pino's default numeric level.
const formatters = {
  level: (label) => ({ level: label })
};

export const logger = pino({ formatters });
export const httpLogger = pinoHttp({ logger });

/**
 Registers handlers for uncaught exceptions and unhandled promise rejections.
 Logs them as errors.
*/
function registerProcessErrorHandlers() {
  process.on("uncaughtException", (err) => {
    logger.error(err, `Uncaught exception: ${err.message}`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, `Unhandled promise rejection`);
  });
}

// Register the process error handlers globally
registerProcessErrorHandlers();
