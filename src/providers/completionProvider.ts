import * as vscode from 'vscode';
import { TokenRegistry } from '../tokenManager/tokenRegistry';
import { ThemeManager } from '../tokenManager/themeManager';
import { Config } from '../utils/config';
import { PinyinSearch } from '../utils/pinyinSearch';
import { CompletionTrigger, TriggerContext } from './completionTrigger';
import { CompletionItemBuilder } from './completionItemBuilder';
import { CompletionSorter } from './completionSorter';
import { CompletionCategories } from './completionCategories';
import { HoverContentBuilder } from './hoverContentBuilder';

/**
 * Ant Design Token 自动补全提供者
 */
export class AntdTokenCompletionProvider
  implements vscode.CompletionItemProvider
{
  private recentlyUsedTokens: string[] = [];
  private readonly MAX_RECENT_TOKENS = 10;
  private readonly MAX_COMPLETION_ITEMS = 50;

  // 缓存
  private completionCache = new Map<
    string,
    { timestamp: number; items: vscode.CompletionItem[]; isIncomplete: boolean }
  >();
  private readonly CACHE_TTL = 60000; // 缓存有效期：60秒

  // 增量过滤
  private lastFilterText = '';
  private lastFilteredTokens: any[] = [];

  constructor(
    private tokenRegistry: TokenRegistry,
    private themeManager: ThemeManager,
    private hoverContentBuilder: HoverContentBuilder,
    private context?: vscode.ExtensionContext
  ) {}

  /**
   * 提供补全项
   */
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    // 检查是否启用补全
    if (!this.isCompletionEnabled()) {
      return undefined;
    }

    // 使用触发器分析上下文
    const triggerContext = CompletionTrigger.analyze(
      document,
      position,
      context
    );

    if (!triggerContext.shouldComplete) {
      return undefined;
    }

    // 尝试从缓存获取
    const cacheKey = this.getCacheKey(triggerContext);
    const cached = this.completionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return new vscode.CompletionList(cached.items, cached.isIncomplete);
    }

    // 获取补全项
    const { items, isIncomplete } = this.getCompletionItems(
      document,
      position,
      triggerContext
    );

    // 缓存结果
    this.completionCache.set(cacheKey, {
      timestamp: Date.now(),
      items,
      isIncomplete
    });

    // 标记 isIncomplete，确保用户继续输入时会重新调用 provider（避免只在截断的 50 条里做本地过滤）
    return new vscode.CompletionList(items, isIncomplete);
  }

  /**
   * 解析补全项（当用户选择补全项时调用）
   */
  resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    // 不在补全列表里展示 documentation（避免左侧详情框）
    return item;
  }

  /**
   * 检查是否启用补全
   */
  private isCompletionEnabled(): boolean {
    return Config.getEnableCompletion();
  }

  /**
   * 获取补全项列表
   */
  private getCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    triggerContext: TriggerContext
  ): { items: vscode.CompletionItem[]; isIncomplete: boolean } {
    // 获取补全类型
    const completionType = CompletionTrigger.getCompletionType(triggerContext);

    // 获取所有 Token（从当前主题）
    const currentTheme = this.themeManager.getCurrentTheme();
    const allTokens = this.tokenRegistry.getByTheme(currentTheme);

    // 过滤
    let tokens = this.filterTokens(allTokens, triggerContext.filterText);

    // 排序
    tokens = CompletionSorter.sort(tokens, {
      filterText: triggerContext.filterText,
      recentTokens: this.recentlyUsedTokens,
      showRecentFirst: Config.getShowRecentTokensFirst()
    });

    const isIncomplete = tokens.length > this.MAX_COMPLETION_ITEMS;

    // 限制数量
    const limitedTokens = tokens.slice(0, this.MAX_COMPLETION_ITEMS);

    // 按分类分组（可选）
    const enableCategoryGroups = Config.getEnableCategoryGroups();
    if (enableCategoryGroups) {
      return {
        items: this.createGroupedCompletionItems(
          limitedTokens,
          completionType,
          triggerContext.replaceRange
        ),
        isIncomplete
      };
    }

    // 创建补全项
    return {
      items: limitedTokens.map((tokenInfo, index) => {
        // 调试：打印前几个 token 信息
        if (index < 3) {
          console.log(`Token ${index}:`, {
            name: tokenInfo.name,
            value: tokenInfo.value,
            category: tokenInfo.category,
            theme: tokenInfo.theme
          });
        }

        return CompletionItemBuilder.build({
          tokenInfo,
          completionType,
          sortIndex: index,
          isRecent: this.recentlyUsedTokens.includes(tokenInfo.name),
          context: this.context,
          replaceRange: triggerContext.replaceRange
        });
      }),
      isIncomplete
    };
  }

  /**
   * 过滤 Token
   */
  private filterTokens(tokens: any[], filterText: string): any[] {
    // 如果是上次过滤结果的扩展，使用增量过滤
    if (
      this.lastFilterText &&
      filterText.startsWith(this.lastFilterText) &&
      this.lastFilteredTokens.length > 0
    ) {
      // 在上次结果基础上继续过滤
      const result = this.doFilter(this.lastFilteredTokens, filterText);
      this.lastFilterText = filterText;
      this.lastFilteredTokens = result;
      return result;
    }

    // 完整过滤
    const result = this.doFilter(tokens, filterText);
    this.lastFilterText = filterText;
    this.lastFilteredTokens = result;
    return result;
  }

  /**
   * 执行过滤
   */
  private doFilter(tokens: any[], filterText: string): any[] {
    if (!filterText || filterText === '--') {
      return tokens;
    }

    const lowerFilter = filterText.toLowerCase();
    const enablePinyin = Config.getEnablePinyinSearch();

    return tokens.filter((token) => {
      const name = token.name.toLowerCase();

      // 1. Token 名称匹配
      if (name.includes(lowerFilter)) {
        return true;
      }

      // 2. 拼音搜索（如果启用）
      if (enablePinyin && token.description) {
        // 移除 -- 前缀进行拼音匹配
        const query = lowerFilter.replace(/^--(?:ant-)?/, '');

        // 拼音首字母匹配
        if (PinyinSearch.matchInitials(token.description, query)) {
          return true;
        }

        // 完整拼音匹配
        if (PinyinSearch.matchFull(token.description, query)) {
          return true;
        }
      }

      // 3. 分类匹配
      if (token.category) {
        const category = token.category.toLowerCase();
        if (category.includes(lowerFilter)) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * 创建分组的补全项
   */
  private createGroupedCompletionItems(
    tokens: any[],
    completionType: 'full' | 'name-only',
    replaceRange?: vscode.Range
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const groups = CompletionCategories.groupByCategory(tokens);

    let sortIndex = 0;

    // 按分类优先级遍历
    const categories = CompletionCategories.getAllCategories();
    for (const category of categories) {
      const groupTokens = groups.get(category.name);
      if (!groupTokens || groupTokens.length === 0) {
        continue;
      }

      // 添加该分类的补全项
      for (const tokenInfo of groupTokens) {
        items.push(
          CompletionItemBuilder.build({
            tokenInfo,
            completionType,
            sortIndex: sortIndex++,
            isRecent: this.recentlyUsedTokens.includes(tokenInfo.name),
            context: this.context,
            replaceRange
          })
        );
      }
    }

    return items;
  }

  /**
   * 构建文档（Markdown）
   */
  private buildDocumentation(tokenName: string): vscode.MarkdownString {
    // 复用 HoverContentBuilder
    const content = this.hoverContentBuilder.build(tokenName);
    return content || new vscode.MarkdownString('Token 信息未找到');
  }

  /**
   * 提取 Token 名称
   */
  private extractTokenName(label: string | vscode.CompletionItemLabel): string {
    if (typeof label === 'string') {
      return label;
    }
    return label.label || '';
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(triggerContext: TriggerContext): string {
    return `${triggerContext.filterText}|${triggerContext.isInsideVar}|${triggerContext.isCssVarDefinition}`;
  }

  /**
   * 记录 Token 使用
   */
  recordTokenUsage(tokenName: string): void {
    // 移除已存在的
    const index = this.recentlyUsedTokens.indexOf(tokenName);
    if (index !== -1) {
      this.recentlyUsedTokens.splice(index, 1);
    }

    // 添加到开头
    this.recentlyUsedTokens.unshift(tokenName);

    // 保持最大数量
    if (this.recentlyUsedTokens.length > this.MAX_RECENT_TOKENS) {
      this.recentlyUsedTokens.pop();
    }
  }

  /**
   * 清空最近使用记录
   */
  clearRecentTokens(): void {
    this.recentlyUsedTokens = [];
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.completionCache.clear();
    this.lastFilterText = '';
    this.lastFilteredTokens = [];
  }
}
