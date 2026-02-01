import * as vscode from 'vscode';
import { ColorConverter } from '../utils/colorConverter';
import { Config } from '../utils/config';

export interface CompletionItemOptions {
  tokenInfo: any;
  completionType: 'full' | 'name-only';
  sortIndex: number;
  isRecent?: boolean;
  context?: vscode.ExtensionContext;
}

/**
 * 补全项构建器
 */
export class CompletionItemBuilder {
  /**
   * 构建补全项
   */
  static build(options: CompletionItemOptions): vscode.CompletionItem {
    const { tokenInfo, completionType, sortIndex, isRecent, context } = options;

    const item = new vscode.CompletionItem(
      tokenInfo.name,
      this.getCompletionKind(tokenInfo)
    );

    // 设置标签
    item.label = this.buildLabel(tokenInfo, isRecent, context);

    // 设置详细信息
    item.detail = this.buildDetail(tokenInfo, context);

    // 不设置 documentation：避免在补全列表左侧弹出详情框
    item.documentation = undefined;

    // 设置插入文本
    item.insertText = this.buildInsertText(tokenInfo, completionType);

    // 设置过滤文本
    item.filterText = tokenInfo.name;

    // 设置排序文本
    // 使用全局最小前缀，确保在 VS Code 合并多个 provider 时优先显示本扩展的候选
    item.sortText = `\u0000${String(sortIndex).padStart(4, '0')}`;

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
    isRecent?: boolean,
    context?: vscode.ExtensionContext
  ): vscode.CompletionItemLabel {
    let label = tokenInfo.name;
    let description = tokenInfo.description || tokenInfo.category;

    // 标记最近使用
    if (isRecent) {
      description = `⏱️ ${description}`;
    }

    return {
      label,
      description
    };
  }

  /**
   * 构建详细信息
   * 对于颜色类型，detail 必须是有效的颜色值，VS Code 会据此显示颜色预览
   */
  private static buildDetail(
    tokenInfo: any,
    context?: vscode.ExtensionContext
  ): string | undefined {
    const detailLevel = Config.getCompletionDetailLevel();

    // 颜色类型优先保证 detail 是可解析的颜色值（用于列表里的颜色预览）
    if (
      (tokenInfo.category === 'color' || tokenInfo.category === 'bg') &&
      tokenInfo.value
    ) {
      const formats = ColorConverter.convertToAllFormats(tokenInfo.value);
      const normalized = formats?.hex ?? tokenInfo.value;
      if (detailLevel === 'minimal') {
        return normalized;
      }
    }

    if (detailLevel === 'minimal') {
      return undefined;
    }

    // 对于颜色类型，必须返回有效的颜色值
    if (
      (tokenInfo.category === 'color' || tokenInfo.category === 'bg') &&
      tokenInfo.value
    ) {
      const formats = ColorConverter.convertToAllFormats(tokenInfo.value);
      return formats?.hex ?? tokenInfo.value;
    }

    // 其他类型直接返回 value
    return tokenInfo.value;
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
