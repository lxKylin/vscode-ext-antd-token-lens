import { CompletionCategories } from './completionCategories';

export interface SortOptions {
  filterText: string;
  recentTokens: string[];
  showRecentFirst: boolean;
}

/**
 * 补全项排序器
 */
export class CompletionSorter {
  /**
   * 排序 Token
   */
  static sort(tokens: any[], options: SortOptions): any[] {
    const { filterText, recentTokens, showRecentFirst } = options;
    const lowerFilter = filterText.toLowerCase();

    return tokens.sort((a, b) => {
      // 1. 最近使用的优先（如果启用）
      if (showRecentFirst) {
        const aRecentIndex = recentTokens.indexOf(a.name);
        const bRecentIndex = recentTokens.indexOf(b.name);

        if (aRecentIndex !== -1 || bRecentIndex !== -1) {
          if (aRecentIndex === -1) {
            return 1;
          }
          if (bRecentIndex === -1) {
            return -1;
          }
          return aRecentIndex - bRecentIndex;
        }
      }

      // 2. 完全匹配优先
      const aExact = a.name.toLowerCase() === lowerFilter;
      const bExact = b.name.toLowerCase() === lowerFilter;
      if (aExact !== bExact) {
        return aExact ? -1 : 1;
      }

      // 3. 前缀匹配优先
      const aPrefix = a.name.toLowerCase().startsWith(lowerFilter);
      const bPrefix = b.name.toLowerCase().startsWith(lowerFilter);
      if (aPrefix !== bPrefix) {
        return aPrefix ? -1 : 1;
      }

      // 4. 匹配位置越靠前优先
      if (lowerFilter) {
        const aIndex = a.name.toLowerCase().indexOf(lowerFilter);
        const bIndex = b.name.toLowerCase().indexOf(lowerFilter);
        if (aIndex !== bIndex && aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
      }

      // 5. 分类优先级
      const aCategory = CompletionCategories.getCategory(a.category || 'other');
      const bCategory = CompletionCategories.getCategory(b.category || 'other');
      if (aCategory.priority !== bCategory.priority) {
        return aCategory.priority - bCategory.priority;
      }

      // 6. 名称长度（短的优先）
      if (a.name.length !== b.name.length) {
        return a.name.length - b.name.length;
      }

      // 7. 字母顺序
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 计算匹配度得分
   */
  static calculateMatchScore(tokenName: string, filterText: string): number {
    if (!filterText) {
      return 0;
    }

    const lowerToken = tokenName.toLowerCase();
    const lowerFilter = filterText.toLowerCase();

    // 完全匹配: 100分
    if (lowerToken === lowerFilter) {
      return 100;
    }

    // 前缀匹配: 80分
    if (lowerToken.startsWith(lowerFilter)) {
      return 80;
    }

    // 包含匹配: 60分
    if (lowerToken.includes(lowerFilter)) {
      return 60;
    }

    // 模糊匹配: 40分
    if (this.fuzzyMatch(lowerToken, lowerFilter)) {
      return 40;
    }

    return 0;
  }

  /**
   * 模糊匹配
   */
  private static fuzzyMatch(text: string, pattern: string): boolean {
    let textIndex = 0;
    let patternIndex = 0;

    while (textIndex < text.length && patternIndex < pattern.length) {
      if (text[textIndex] === pattern[patternIndex]) {
        patternIndex++;
      }
      textIndex++;
    }

    return patternIndex === pattern.length;
  }
}
