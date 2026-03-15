/**
 * Token 注册表
 * 提供中心化的 Token 管理和高效查询能力
 */

import { TokenCategory } from '@/data/antdTokens';
import {
  ExtendedTokenInfo,
  SourceBaseTheme,
  ThemeDescriptor
} from './sourceTypes';

// 导出 TokenInfo 以供其他模块使用
export type TokenInfo = ExtendedTokenInfo;
export type { TokenCategory };

export interface TokenQueryOptions {
  themeId?: string;
  baseTheme?: SourceBaseTheme;
  includeFallback?: boolean;
}

export class TokenRegistry {
  /** 按名称索引的 Token */
  private readonly tokens: Map<string, TokenInfo[]>;

  /** 按分类索引的 Token */
  private readonly tokensByCategory: Map<TokenCategory, TokenInfo[]>;

  /** 按基础主题聚合后的 Token */
  private readonly tokensByTheme: Map<SourceBaseTheme, Map<string, TokenInfo>>;

  /** 按命名主题索引的 Token */
  private readonly tokensByThemeId: Map<string, Map<string, TokenInfo>>;

  /** 当前已知主题描述 */
  private readonly themeDescriptors: Map<string, ThemeDescriptor>;

  /** 当前激活主题解析器 */
  private activeThemeResolver?: () => ThemeDescriptor | undefined;

  /** 所有 Token 名称的缓存 */
  private allTokenNamesCache: string[] | null = null;

  constructor() {
    this.tokens = new Map();
    this.tokensByCategory = new Map();
    this.tokensByTheme = new Map();
    this.tokensByThemeId = new Map();
    this.themeDescriptors = new Map();
    this.tokensByTheme.set('light', new Map());
    this.tokensByTheme.set('dark', new Map());
  }

  setActiveThemeResolver(
    resolver: (() => ThemeDescriptor | undefined) | undefined
  ): void {
    this.activeThemeResolver = resolver;
  }

  /**
   * 注册单个 Token
   */
  register(token: TokenInfo): void {
    const normalizedToken = this.normalizeToken(token);

    // 按名称索引
    if (!this.tokens.has(normalizedToken.name)) {
      this.tokens.set(normalizedToken.name, []);
    }
    this.tokens.get(normalizedToken.name)!.push(normalizedToken);

    // 按分类索引
    if (!this.tokensByCategory.has(normalizedToken.category)) {
      this.tokensByCategory.set(normalizedToken.category, []);
    }
    this.tokensByCategory.get(normalizedToken.category)!.push(normalizedToken);

    // 按命名主题索引
    if (normalizedToken.themeId) {
      if (!this.tokensByThemeId.has(normalizedToken.themeId)) {
        this.tokensByThemeId.set(normalizedToken.themeId, new Map());
      }
      this.setIfHigherPriority(
        this.tokensByThemeId.get(normalizedToken.themeId)!,
        normalizedToken
      );
    }

    // 按基础主题聚合索引
    this.setIfHigherPriority(
      this.tokensByTheme.get(normalizedToken.theme)!,
      normalizedToken
    );

    if (normalizedToken.themeId) {
      this.themeDescriptors.set(normalizedToken.themeId, {
        id: normalizedToken.themeId,
        name: normalizedToken.themeName ?? normalizedToken.themeId,
        baseTheme: normalizedToken.baseTheme ?? normalizedToken.theme,
        sourceId: normalizedToken.sourceId,
        sourceType: normalizedToken.sourceType,
        isBuiltin: normalizedToken.source === 'builtin',
        priority: normalizedToken.priority,
        metadata: {
          sourceFile: normalizedToken.sourceFile
        }
      });
    }

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
      return this.getToken(name, { baseTheme: theme });
    }

    // 如果没有指定主题，返回第一个匹配的
    const tokenList = this.tokens.get(name);
    return tokenList && tokenList.length > 0 ? tokenList[0] : undefined;
  }

  getToken(
    name: string,
    options: TokenQueryOptions = {}
  ): TokenInfo | undefined {
    const includeFallback = options.includeFallback !== false;
    const resolvedBaseTheme =
      options.baseTheme ??
      (options.themeId
        ? this.themeDescriptors.get(options.themeId)?.baseTheme
        : undefined) ??
      this.activeThemeResolver?.()?.baseTheme;

    const activeTheme = this.activeThemeResolver?.();
    const resolvedThemeId =
      options.themeId ??
      (resolvedBaseTheme && activeTheme?.baseTheme === resolvedBaseTheme
        ? activeTheme.id
        : undefined);

    if (resolvedThemeId) {
      const themeToken = this.tokensByThemeId.get(resolvedThemeId)?.get(name);
      if (themeToken) {
        return themeToken;
      }
    }

    if (includeFallback && resolvedBaseTheme) {
      return this.tokensByTheme.get(resolvedBaseTheme)?.get(name);
    }

    return undefined;
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
    this.allTokenNamesCache ??= Array.from(this.tokens.keys());
    return this.allTokenNamesCache;
  }

  /**
   * 获取指定主题的所有 Token
   */
  getByTheme(theme: 'light' | 'dark'): TokenInfo[] {
    return this.getEffectiveTokens({ baseTheme: theme });
  }

  getByThemeId(themeId: string): TokenInfo[] {
    const themeMap = this.tokensByThemeId.get(themeId);
    return themeMap ? Array.from(themeMap.values()) : [];
  }

  getEffectiveTokens(options: TokenQueryOptions = {}): TokenInfo[] {
    const baseTheme =
      options.baseTheme ??
      (options.themeId
        ? this.themeDescriptors.get(options.themeId)?.baseTheme
        : undefined) ??
      this.activeThemeResolver?.()?.baseTheme;

    if (!baseTheme) {
      return [];
    }

    const resolvedThemeId =
      options.themeId ??
      (this.activeThemeResolver?.()?.baseTheme === baseTheme
        ? this.activeThemeResolver?.()?.id
        : undefined);
    const effectiveMap = new Map(this.tokensByTheme.get(baseTheme));

    if (resolvedThemeId) {
      const themeMap = this.tokensByThemeId.get(resolvedThemeId);
      if (themeMap) {
        for (const [name, token] of themeMap.entries()) {
          effectiveMap.set(name, token);
        }
      }
    }

    return Array.from(effectiveMap.values());
  }

  getTokenVariants(name: string): TokenInfo[] {
    const activeThemeId = this.activeThemeResolver?.()?.id;
    const variants = [...(this.tokens.get(name) ?? [])];

    return variants.sort((left, right) => {
      if (left.themeId === activeThemeId && right.themeId !== activeThemeId) {
        return -1;
      }
      if (left.themeId !== activeThemeId && right.themeId === activeThemeId) {
        return 1;
      }
      if ((left.baseTheme ?? left.theme) !== (right.baseTheme ?? right.theme)) {
        return (left.baseTheme ?? left.theme).localeCompare(
          right.baseTheme ?? right.theme
        );
      }
      const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return (left.themeName ?? left.themeId ?? left.name).localeCompare(
        right.themeName ?? right.themeId ?? right.name
      );
    });
  }

  getThemes(): ThemeDescriptor[] {
    return Array.from(this.themeDescriptors.values()).sort((left, right) => {
      if (left.baseTheme !== right.baseTheme) {
        return left.baseTheme.localeCompare(right.baseTheme);
      }
      const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.name.localeCompare(right.name);
    });
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
    this.tokensByThemeId.clear();
    this.themeDescriptors.clear();
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

  private normalizeToken(token: TokenInfo): TokenInfo {
    const baseTheme = token.baseTheme ?? token.theme;
    const themeId = token.themeId ?? token.theme;
    const themeName = token.themeName ?? themeId;

    return {
      ...token,
      baseTheme,
      theme: baseTheme,
      themeId,
      themeName
    };
  }

  private setIfHigherPriority(
    target: Map<string, TokenInfo>,
    token: TokenInfo
  ): void {
    const existing = target.get(token.name);
    if (!existing) {
      target.set(token.name, token);
      return;
    }

    const existingPriority = existing.priority ?? Number.MAX_SAFE_INTEGER;
    const nextPriority = token.priority ?? Number.MAX_SAFE_INTEGER;
    if (nextPriority < existingPriority) {
      target.set(token.name, token);
      return;
    }

    if (
      nextPriority === existingPriority &&
      (existing.source === 'builtin') !== (token.source === 'builtin')
    ) {
      if (token.source !== 'builtin') {
        target.set(token.name, token);
      }
    }
  }
}
