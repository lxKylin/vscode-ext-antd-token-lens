export type SourceHealth = 'idle' | 'ok' | 'warning' | 'error';

export type SourceDiagnosticSeverity = 'warning' | 'error';

export const SourceErrorCode = {
  CONFIG_MISSING_INPUT: 'CONFIG_MISSING_INPUT',
  CONFIG_INVALID_THEME_CONFIG: 'CONFIG_INVALID_THEME_CONFIG',
  CONFIG_INVALID_DESIGN_TOKEN: 'CONFIG_INVALID_DESIGN_TOKEN',
  CONFIG_WATCH_REQUIRES_FILEPATH: 'CONFIG_WATCH_REQUIRES_FILEPATH',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  FILE_UNSUPPORTED_EXTENSION: 'FILE_UNSUPPORTED_EXTENSION',
  EXPORT_NOT_FOUND: 'EXPORT_NOT_FOUND',
  EXPORT_NOT_PLAIN_OBJECT: 'EXPORT_NOT_PLAIN_OBJECT',
  EXPORT_IS_FUNCTION: 'EXPORT_IS_FUNCTION',
  EXPORT_UNSUPPORTED_EXPRESSION: 'EXPORT_UNSUPPORTED_EXPRESSION',
  ANTD_RESOLVE_FAILED: 'ANTD_RESOLVE_FAILED',
  ANTD_PACKAGE_NOT_FOUND: 'ANTD_PACKAGE_NOT_FOUND',
  ANTD_GET_DESIGN_TOKEN_UNAVAILABLE: 'ANTD_GET_DESIGN_TOKEN_UNAVAILABLE',
  ANTD_GET_DESIGN_TOKEN_INVALID_RETURN: 'ANTD_GET_DESIGN_TOKEN_INVALID_RETURN',
  ANTD_ALGORITHM_UNKNOWN: 'ANTD_ALGORITHM_UNKNOWN',
  ANTD_ALGORITHM_UNAVAILABLE: 'ANTD_ALGORITHM_UNAVAILABLE',
  LOAD_FAILED: 'LOAD_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
} as const;

export type SourceErrorCodeValue =
  (typeof SourceErrorCode)[keyof typeof SourceErrorCode];

export interface SourceDiagnostic {
  severity: SourceDiagnosticSeverity;
  code: SourceErrorCodeValue;
  message: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceValidationResult {
  valid: boolean;
  error?: SourceDiagnostic;
  warnings?: SourceDiagnostic[];
  metadata?: Record<string, unknown>;
}

interface SourceErrorOptions {
  code: SourceErrorCodeValue;
  message: string;
  severity?: SourceDiagnosticSeverity;
  details?: string;
  metadata?: Record<string, unknown>;
  cause?: unknown;
}

export class TokenSourceError extends Error {
  readonly code: SourceErrorCodeValue;
  readonly severity: SourceDiagnosticSeverity;
  readonly details?: string;
  readonly metadata?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(options: SourceErrorOptions) {
    super(options.message);
    this.name = 'TokenSourceError';
    this.code = options.code;
    this.severity = options.severity ?? 'error';
    this.details = options.details;
    this.metadata = options.metadata;
    this.cause = options.cause;
  }

  toDiagnostic(): SourceDiagnostic {
    return {
      severity: this.severity,
      code: this.code,
      message: this.message,
      details: this.details,
      metadata: this.metadata
    };
  }
}

export function toSourceDiagnostic(
  error: unknown,
  fallback: Omit<SourceErrorOptions, 'cause'>
): SourceDiagnostic {
  if (error instanceof TokenSourceError) {
    return error.toDiagnostic();
  }

  if (error instanceof Error) {
    return {
      severity: fallback.severity ?? 'error',
      code: fallback.code,
      message: error.message || fallback.message,
      details: fallback.details,
      metadata: fallback.metadata
    };
  }

  return {
    severity: fallback.severity ?? 'error',
    code: fallback.code,
    message: String(error ?? fallback.message),
    details: fallback.details,
    metadata: fallback.metadata
  };
}

export function createWarning(
  code: SourceErrorCodeValue,
  message: string,
  metadata?: Record<string, unknown>
): SourceDiagnostic {
  return {
    severity: 'warning',
    code,
    message,
    metadata
  };
}
