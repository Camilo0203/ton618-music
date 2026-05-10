export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error: (context: string, message: string, meta?: Record<string, unknown>) => void;
  warn: (context: string, message: string, meta?: Record<string, unknown>) => void;
  info: (context: string, message: string, meta?: Record<string, unknown>) => void;
  debug: (context: string, message: string, meta?: Record<string, unknown>) => void;
}

export interface StructuredLoggerOptions {
  /** Nivel mínimo a loggear */
  minLevel?: LogLevel;
  /** Modo legible para humanos (desarrollo). Si es false, emite JSON (producción). */
  pretty?: boolean;
  /** Prefijo de los mensajes pretty */
  prefix?: string;
}

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Crea un logger estructurado que funciona tanto en Node como en browser.
 * En producción (pretty=false) emite JSON, ideal para ingestion de logs.
 */
export function createStructuredLogger(options: StructuredLoggerOptions = {}): Logger {
  const { minLevel = 'info', pretty = false, prefix = '[TON618]' } = options;

  function shouldLog(level: LogLevel): boolean {
    return LEVELS[level] <= LEVELS[minLevel];
  }

  function log(
    level: LogLevel,
    context: string,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    if (!shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level,
      context,
      message,
      env: typeof process !== 'undefined' ? process.env?.NODE_ENV : 'browser',
      ...meta,
    };

    if (pretty) {
      const fn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      fn(`${prefix} [${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`);
      if (meta && Object.keys(meta).length > 0) {
        fn('  →', meta);
      }
    } else {
      // JSON mode — single line
      console.log(JSON.stringify(payload));
    }
  }

  return {
    error: (ctx, msg, meta) => log('error', ctx, msg, meta),
    warn: (ctx, msg, meta) => log('warn', ctx, msg, meta),
    info: (ctx, msg, meta) => log('info', ctx, msg, meta),
    debug: (ctx, msg, meta) => log('debug', ctx, msg, meta),
  };
}

/** Logger global por defecto en modo pretty (desarrollo) */
export const defaultLogger = createStructuredLogger({ pretty: true });
