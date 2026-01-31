import * as vscode from 'vscode';

export interface CategoryInfo {
  name: string;
  label: string;
  priority: number;
  icon?: string;
}

/**
 * 补全项分类管理器
 */
export class CompletionCategories {
  private static categories: Map<string, CategoryInfo> = new Map([
    ['color', { name: 'color', label: '🎨 颜色', priority: 1, icon: '🎨' }],
    ['bg', { name: 'bg', label: '🖼️ 背景', priority: 2, icon: '🖼️' }],
    ['text', { name: 'text', label: '📝 文本', priority: 3, icon: '📝' }],
    ['border', { name: 'border', label: '🔲 边框', priority: 4, icon: '🔲' }],
    ['shadow', { name: 'shadow', label: '🌓 阴影', priority: 5, icon: '🌓' }],
    ['size', { name: 'size', label: '📏 尺寸', priority: 6, icon: '📏' }],
    ['font', { name: 'font', label: '🔤 字体', priority: 7, icon: '🔤' }],
    ['other', { name: 'other', label: '📦 其他', priority: 99, icon: '📦' }]
  ]);

  /**
   * 获取分类信息
   */
  static getCategory(categoryName: string): CategoryInfo {
    return this.categories.get(categoryName) || this.categories.get('other')!;
  }

  /**
   * 获取所有分类
   */
  static getAllCategories(): CategoryInfo[] {
    return Array.from(this.categories.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * 按分类分组 Token
   */
  static groupByCategory(tokens: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const token of tokens) {
      const category = token.category || 'other';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(token);
    }

    return groups;
  }

  /**
   * 创建分类分隔符补全项
   */
  static createCategorySeparator(categoryName: string): vscode.CompletionItem {
    const category = this.getCategory(categoryName);

    const item = new vscode.CompletionItem(
      category.label,
      vscode.CompletionItemKind.Folder
    );

    item.sortText = `_${String(category.priority).padStart(2, '0')}`;
    item.detail = `${categoryName} tokens`;

    return item;
  }
}
