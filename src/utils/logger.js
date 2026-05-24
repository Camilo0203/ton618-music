"use strict";

/**
 * Logger estructurado para TON618 Music
 * Usa Winston con formato JSON para producción y coloreado para desarrollo.
 */

const winston = require("winston");
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";

const logDir = process.env.LOG_DIR || path.join(process.cwd(), "logs");

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp, component, ...meta }) => {
    const comp = component ? `[${component}]` : "";
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} ${level} ${comp} ${message} ${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: isDev ? consoleFormat : fileFormat,
    level: process.env.LOG_LEVEL || "info",
  }),
];

// En producción, también log a archivo
if (!isDev) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "music-error.log"),
      level: "error",
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "music-combined.log"),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  defaultMeta: { service: "ton618-music" },
  transports,
  exceptionHandlers: transports,
  rejectionHandlers: transports,
  exitOnError: false,
});

/**
 * Crea un logger con componente prefijado.
 */
function createLogger(component) {
  return {
    debug: (msg, meta = {}) => logger.debug(msg, { component, ...meta }),
    info: (msg, meta = {}) => logger.info(msg, { component, ...meta }),
    warn: (msg, meta = {}) => logger.warn(msg, { component, ...meta }),
    error: (msg, meta = {}) => logger.error(msg, { component, ...meta }),
  };
}

module.exports = { logger, createLogger };
