import { TokenCategory, TokenInfo } from '@/data/antdTokens';

export type ValueDecoratorMode = 'compact' | 'full';

export interface TokenValueFormatterOptions {
  enabledCategories: readonly TokenCategory[];
  maxLength: number;
  mode: ValueDecoratorMode;
}

export class TokenValueFormatter {
  static format(
    tokenInfo: TokenInfo,
    options: TokenValueFormatterOptions
  ): string | undefined {
    if (tokenInfo.isColor) {
      return undefined;
    }

    if (!options.enabledCategories.includes(tokenInfo.category)) {
      return undefined;
    }

    const formatted = this.formatByCategory(tokenInfo, options.mode);
    if (!formatted) {
      return undefined;
    }

    return this.truncate(formatted, options.maxLength);
  }

  private static formatByCategory(
    tokenInfo: TokenInfo,
    mode: ValueDecoratorMode
  ): string | undefined {
    const value = tokenInfo.value.trim();

    switch (tokenInfo.category) {
      case 'size':
      case 'line':
      case 'shadow':
      case 'other':
      case 'zIndex':
        return value;
      case 'font':
        return this.compactNumericValue(value, mode);
      case 'motion':
        return this.formatMotion(value, mode);
      case 'opacity':
        return this.formatOpacity(value, mode);
      default:
        return value;
    }
  }

  private static formatMotion(value: string, mode: ValueDecoratorMode): string {
    const trimmedValue = value.trim();
    const milliseconds = this.toMilliseconds(trimmedValue);

    if (milliseconds === undefined || trimmedValue.endsWith('ms')) {
      return trimmedValue;
    }

    const normalizedMs = this.formatNumber(milliseconds);
    return mode === 'full'
      ? `${trimmedValue} (${normalizedMs}ms)`
      : `${trimmedValue} · ${normalizedMs}ms`;
  }

  private static formatOpacity(
    value: string,
    mode: ValueDecoratorMode
  ): string {
    const trimmedValue = value.trim();
    const numericValue = Number(trimmedValue);

    if (Number.isNaN(numericValue)) {
      return trimmedValue;
    }

    const percentage = this.formatNumber(numericValue * 100);
    return mode === 'full'
      ? `${trimmedValue} (${percentage}%)`
      : `${trimmedValue} · ${percentage}%`;
  }

  private static compactNumericValue(
    value: string,
    mode: ValueDecoratorMode
  ): string {
    if (mode === 'full') {
      return value;
    }

    const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
    if (!match) {
      return value;
    }

    const numericPart = Number(match[1]);
    if (Number.isNaN(numericPart)) {
      return value;
    }

    const suffix = match[2] ?? '';
    return `${this.formatNumber(numericPart)}${suffix}`;
  }

  private static toMilliseconds(value: string): number | undefined {
    const match = value.match(/^(-?\d+(?:\.\d+)?)(ms|s)$/i);
    if (!match) {
      return undefined;
    }

    const numericValue = Number(match[1]);
    if (Number.isNaN(numericValue)) {
      return undefined;
    }

    return match[2].toLowerCase() === 's' ? numericValue * 1000 : numericValue;
  }

  private static truncate(value: string, maxLength: number): string {
    if (maxLength <= 0 || value.length <= maxLength) {
      return value;
    }

    if (maxLength <= 3) {
      return '.'.repeat(maxLength);
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }

  private static formatNumber(value: number): string {
    if (Number.isInteger(value)) {
      return String(value);
    }

    return value
      .toFixed(2)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*[1-9])0+$/, '$1');
  }
}
