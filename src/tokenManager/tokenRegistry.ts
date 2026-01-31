/**
 * Token 注册表
 * 提供中心化的 Token 管理和高效查询能力
 */

import { TokenInfo, TokenCategory } from '../data/antdTokens';

// 导出 TokenInfo 以供其他模块使用
export type { TokenInfo, TokenCategory };

export class TokenRegistry {
  /** 按名称索引的 Token */
  private tokens: Map<string, TokenInfo[]>;

  /** 按分类索引的 Token */
  private tokensByCategory: Map<TokenCategory, TokenInfo[]>;

  /** 按主题索引的 Token */
  private tokensByTheme: Map<'light' | 'dark', Map<string, TokenInfo>>;

  /** 所有 Token 名称的缓存 */
  private allTokenNamesCache: string[] | null = null;

  constructor() {
    this.tokens = new Map();
    this.tokensByCategory = new Map();
    this.tokensByTheme = new Map();
    this.tokensByTheme.set('light', new Map());
    this.tokensByTheme.set('dark', new Map());
  }

  /**
   * 注册单个 Token
   */
  register(token: TokenInfo): void {
    // 按名称索引
    if (!this.tokens.has(token.name)) {
      this.tokens.set(token.name, []);
    }
    this.tokens.get(token.name)!.push(token);

    // 按分类索引
    if (!this.tokensByCategory.has(token.category)) {
      this.tokensByCategory.set(token.category, []);
    }
    this.tokensByCategory.get(token.category)!.push(token);

    // 按主题索引
    this.tokensByTheme.get(token.theme)!.set(token.name, token);

    // 清除缓存
    this.allTokenNamesCache = null;
  }

  /**
   * 批量注册 Token
   */
  registerBatch(tokens: TokenInfo[]): void {
    for (const token of tokens) {
      this.register(token);
    }
  }

  /**
   * 获取指定名称的 Token
   * @param name Token 名称
   * @param theme 可选，指定主题
   */
  get(name: string, theme?: 'light' | 'dark'): TokenInfo | undefined {
    if (theme) {
      return this.tokensByTheme.get(theme)?.get(name);
    }

    // 如果没有指定主题，返回第一个匹配的
    const tokenList = this.tokens.get(name);
    return tokenList && tokenList.length > 0 ? tokenList[0] : undefined;
  }

  /**
   * 获取指定分类的所有 Token
   */
  getByCategory(category: TokenCategory): TokenInfo[] {
    return this.tokensByCategory.get(category) || [];
  }

  /**
   * 获取所有 Token 名称列表（去重）
   */
  getAllTokenNames(): string[] {
    if (this.allTokenNamesCache === null) {
      this.allTokenNamesCache = Array.from(this.tokens.keys());
    }
    return this.allTokenNamesCache;
  }

  /**
   * 获取指定主题的所有 Token
   */
  getByTheme(theme: 'light' | 'dark'): TokenInfo[] {
    const themeMap = this.tokensByTheme.get(theme);
    return themeMap ? Array.from(themeMap.values()) : [];
  }

  /**
   * 搜索 Token（支持模糊匹配）
   * @param keyword 搜索关键字
   * @param theme 可选，指定主题
   */
  search(keyword: string, theme?: 'light' | 'dark'): TokenInfo[] {
    const lowerKeyword = keyword.toLowerCase();
    const results: TokenInfo[] = [];

    if (theme) {
      // 在指定主题中搜索
      const themeTokens = this.getByTheme(theme);
      for (const token of themeTokens) {
        if (token.name.toLowerCase().includes(lowerKeyword)) {
          results.push(token);
        }
      }
    } else {
      // 在所有 Token 中搜索（避免重复）
      const seenNames = new Set<string>();
      for (const [name, tokenList] of this.tokens.entries()) {
        if (name.toLowerCase().includes(lowerKeyword) && !seenNames.has(name)) {
          seenNames.add(name);
          results.push(...tokenList);
        }
      }
    }

    // 按相关度排序：前缀匹配优先
    return results.sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(lowerKeyword);
      const bStartsWith = b.name.toLowerCase().startsWith(lowerKeyword);

      if (aStartsWith && !bStartsWith) {
        return -1;
      }
      if (!aStartsWith && bStartsWith) {
        return 1;
      }

      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 检查 Token 是否存在
   */
  has(name: string): boolean {
    return this.tokens.has(name);
  }

  /**
   * 清空所有 Token
   */
  clear(): void {
    this.tokens.clear();
    this.tokensByCategory.clear();
    this.tokensByTheme.get('light')?.clear();
    this.tokensByTheme.get('dark')?.clear();
    this.allTokenNamesCache = null;
  }

  /**
   * 获取 Token 总数
   */
  get size(): number {
    let count = 0;
    for (const tokenList of this.tokens.values()) {
      count += tokenList.length;
    }
    return count;
  }

  /**
   * 获取唯一 Token 名称数量
   */
  get uniqueSize(): number {
    return this.tokens.size;
  }
}
