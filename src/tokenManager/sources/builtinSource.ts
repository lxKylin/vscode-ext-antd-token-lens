/**
 * 内置 Token 数据源
 * 从内置的 Ant Design Token 数据加载
 */

import { BaseTokenSource } from './baseSource';
import { SourceType, SourceConfig, ExtendedTokenInfo } from '../sourceTypes';
import { loadBuiltinTokens, TokenInfo } from '@/data/antdTokens';

export class BuiltinTokenSource extends BaseTokenSource {
  private assetsPath: string;

  constructor(assetsPath: string, config?: Partial<SourceConfig>) {
    super(SourceType.BUILTIN, {
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100, // 默认优先级最低
      watch: false,
      ...config
    });
    this.assetsPath = assetsPath;
  }

  async load(): Promise<ExtendedTokenInfo[]> {
    const tokens: ExtendedTokenInfo[] = [];

    try {
      // 加载内置 Token
      const builtinTokens = loadBuiltinTokens(this.assetsPath);

      // 转换为 ExtendedTokenInfo
      for (const token of [...builtinTokens.light, ...builtinTokens.dark]) {
        tokens.push({
          ...token,
          sourceType: SourceType.BUILTIN,
          priority: this.config.priority
        });
      }

      console.log(`[BuiltinSource] Loaded ${tokens.length} tokens`);
      return tokens;
    } catch (error) {
      console.error('[BuiltinSource] Load failed:', error);
      return [];
    }
  }

  async validate(): Promise<boolean> {
    // 内置数据源始终可用
    return this.config.enabled;
  }

  getDescription(): string {
    return 'Ant Design 官方内置 Token';
  }
}
