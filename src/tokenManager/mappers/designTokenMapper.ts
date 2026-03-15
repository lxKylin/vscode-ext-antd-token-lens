import { ExtendedTokenInfo, SourceBaseTheme, SourceType } from '../sourceTypes';
import { inferTokenCategory, isColorValue } from '@/data/antdTokens';
import { TokenNameConverter } from '@/utils/tokenNameConverter';

export interface DesignTokenMapperOptions {
  baseTheme: SourceBaseTheme;
  priority?: number;
  sourceFile?: string;
  source?: 'builtin' | 'custom';
  sourceType?: SourceType;
}

export function mapDesignTokens(
  designTokens: Record<string, unknown>,
  options: DesignTokenMapperOptions
): ExtendedTokenInfo[] {
  const mappedTokens: ExtendedTokenInfo[] = [];

  for (const [tokenName, rawValue] of Object.entries(designTokens)) {
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
      continue;
    }

    const name = tokenName.startsWith('--')
      ? tokenName
      : TokenNameConverter.jsToCss(tokenName);
    const value = String(rawValue).trim();

    mappedTokens.push({
      name,
      value,
      theme: options.baseTheme,
      category: inferTokenCategory(name),
      source: options.source ?? 'custom',
      sourceType: options.sourceType ?? SourceType.ANTD_THEME,
      sourceFile: options.sourceFile,
      priority: options.priority,
      isColor: isColorValue(value)
    });
  }

  return mappedTokens;
}
