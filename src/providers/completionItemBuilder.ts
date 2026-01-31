import * as vscode from 'vscode';
import { ColorConverter } from '../utils/colorConverter';
import { Config } from '../utils/config';

export interface CompletionItemOptions {
  tokenInfo: any;
  completionType: 'full' | 'name-only';
  sortIndex: number;
  isRecent?: boolean;
}

/**
 * 补全项构建器
 */
export class CompletionItemBuilder {
  /**
   * 构建补全项
   */
  static build(options: CompletionItemOptions): vscode.CompletionItem {
    const { tokenInfo, completionType, sortIndex, isRecent } = options;

    const item = new vscode.CompletionItem(
      tokenInfo.name,
      this.getCompletionKind(tokenInfo)
    );

    // 设置标签
    item.label = this.buildLabel(tokenInfo, isRecent);

    // 设置详细信息
    item.detail = this.buildDetail(tokenInfo);

    // 设置插入文本
    item.insertText = this.buildInsertText(tokenInfo, completionType);

    // 设置过滤文本
    item.filterText = tokenInfo.name;

    // 设置排序文本
    item.sortText = String(sortIndex).padStart(4, '0');

    // 设置命令
    item.command = {
      command: 'antdToken.onCompletionItemSelected',
      title: 'Record Token Usage',
      arguments: [tokenInfo.name]
    };

    // 设置标签
    item.tags = this.getCompletionTags(tokenInfo);

    return item;
  }

  /**
   * 构建标签
   */
  private static buildLabel(
    tokenInfo: any,
    isRecent?: boolean
  ): vscode.CompletionItemLabel {
    let description = tokenInfo.description || tokenInfo.category;

    // 标记最近使用
    if (isRecent) {
      description = `⏱️ ${description}`;
    }

    return {
      label: tokenInfo.name,
      description
    };
  }

  /**
   * 构建详细信息
   */
  private static buildDetail(tokenInfo: any): string | undefined {
    const detailLevel = Config.getCompletionDetailLevel();

    if (detailLevel === 'minimal') {
      return undefined;
    }

    // 显示当前主题的值
    const currentTheme = tokenInfo.currentTheme || 'light';
    const value = tokenInfo.themes?.[currentTheme];

    if (!value) {
      return undefined;
    }

    if (detailLevel === 'normal') {
      return value;
    }

    // detailed 模式：显示更多信息
    let detail = value;

    // 如果是颜色，添加格式转换
    if (ColorConverter.isValidColor(value)) {
      const formats = ColorConverter.convertToAllFormats(value);
      if (formats) {
        detail += ` | rgb: ${formats.rgb}`;
      }
    }

    return detail;
  }

  /**
   * 构建插入文本
   */
  private static buildInsertText(
    tokenInfo: any,
    completionType: 'full' | 'name-only'
  ): string | vscode.SnippetString {
    if (completionType === 'name-only') {
      return tokenInfo.name;
    }

    // 完整模式：插入 var() 并支持 fallback
    return new vscode.SnippetString(
      `var(${tokenInfo.name}\${1:, \${2:fallback}})$0`
    );
  }

  /**
   * 获取补全项类型
   */
  private static getCompletionKind(tokenInfo: any): vscode.CompletionItemKind {
    switch (tokenInfo.category) {
      case 'color':
      case 'bg':
      case 'background':
        return vscode.CompletionItemKind.Color;
      case 'text':
        return vscode.CompletionItemKind.Text;
      case 'size':
      case 'font':
        return vscode.CompletionItemKind.Unit;
      default:
        return vscode.CompletionItemKind.Variable;
    }
  }

  /**
   * 获取补全项标签
   */
  private static getCompletionTags(
    tokenInfo: any
  ): vscode.CompletionItemTag[] | undefined {
    const tags: vscode.CompletionItemTag[] = [];

    if (tokenInfo.deprecated) {
      tags.push(vscode.CompletionItemTag.Deprecated);
    }

    return tags.length > 0 ? tags : undefined;
  }
}
