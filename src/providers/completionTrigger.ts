import * as vscode from 'vscode';

export interface TriggerContext {
  isInsideVar: boolean; // 是否在 var() 内部
  isCssVarDefinition: boolean; // 是否在 CSS 变量定义位置
  filterText: string; // 已输入的过滤文本
  shouldComplete: boolean; // 是否应该触发补全
}

/**
 * 补全触发器分析
 */
export class CompletionTrigger {
  /**
   * 分析触发上下文
   */
  static analyze(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext
  ): TriggerContext {
    const line = document.lineAt(position.line).text;
    const textBeforeCursor = line.substring(0, position.character);

    // 检查是否在 var() 内部
    const isInsideVar = this.isInsideVarFunction(textBeforeCursor);

    // 检查是否在 CSS 变量定义位置
    const isCssVarDefinition = this.isCssVariableDefinition(document, position);

    // 提取过滤文本
    const filterText = this.extractFilterText(textBeforeCursor);

    // 判断是否应该触发补全
    const shouldComplete = this.shouldTriggerCompletion(
      textBeforeCursor,
      context,
      isInsideVar,
      isCssVarDefinition
    );

    return {
      isInsideVar,
      isCssVarDefinition,
      filterText,
      shouldComplete
    };
  }

  /**
   * 检查是否在 var() 函数内部
   */
  private static isInsideVarFunction(text: string): boolean {
    // 匹配 var( 之后，) 之前的位置
    const varMatch = text.match(/var\([^)]*$/);
    return varMatch !== null;
  }

  /**
   * 检查是否在 CSS 变量定义位置
   */
  private static isCssVariableDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    const line = document.lineAt(position.line).text;
    const textBeforeCursor = line.substring(0, position.character);

    // 检查是否以 -- 开头（忽略前导空格）
    if (!/^\s*--/.test(textBeforeCursor)) {
      return false;
    }

    // 向上查找是否在选择器的声明块内
    for (let i = position.line - 1; i >= 0; i--) {
      const prevLine = document.lineAt(i).text.trim();

      // 找到开始的 {
      if (prevLine.endsWith('{')) {
        return true;
      }

      // 找到结束的 }，说明不在声明块内
      if (prevLine.endsWith('}')) {
        return false;
      }
    }

    return false;
  }

  /**
   * 提取过滤文本
   */
  private static extractFilterText(text: string): string {
    const match = text.match(/--(?:ant-?)?[\w-]*$/);
    return match ? match[0] : '';
  }

  /**
   * 判断是否应该触发补全
   */
  private static shouldTriggerCompletion(
    textBeforeCursor: string,
    context: vscode.CompletionContext,
    isInsideVar: boolean,
    isCssVarDefinition: boolean
  ): boolean {
    // 1. 如果是手动触发（Ctrl+Space），总是触发
    if (context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
      return true;
    }

    // 1.1 VS Code 因为 isIncomplete 触发的补全刷新
    // 此时 triggerCharacter 可能为空，但用户正在继续输入，应允许继续补全
    if (
      context.triggerKind ===
      vscode.CompletionTriggerKind.TriggerForIncompleteCompletions
    ) {
      // 仅在 var() 或 CSS 变量定义位置继续触发，避免在其他文本场景造成噪音
      if (isInsideVar && /--[\w-]*$/.test(textBeforeCursor)) {
        return true;
      }
      if (isCssVarDefinition && /--[\w-]*$/.test(textBeforeCursor)) {
        return true;
      }
      return false;
    }

    // 2. 如果是触发字符触发
    if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter) {
      const triggerChar = context.triggerCharacter;

      // 输入 ( 且前面是 var
      if (triggerChar === '(' && /var\($/.test(textBeforeCursor)) {
        return true;
      }

      // 输入 - 且前面已经有 -
      if (triggerChar === '-' && /--?$/.test(textBeforeCursor)) {
        return true;
      }
    }

    // 3. 如果在 var() 内部且输入了自定义属性前缀（--）
    if (isInsideVar && /--[\w-]*$/.test(textBeforeCursor)) {
      return true;
    }

    // 4. 如果在 CSS 变量定义位置且输入了自定义属性前缀（--）
    if (isCssVarDefinition && /--[\w-]*$/.test(textBeforeCursor)) {
      return true;
    }

    return false;
  }

  /**
   * 判断补全类型
   */
  static getCompletionType(context: TriggerContext): 'full' | 'name-only' {
    // 在 var() 内部，只插入名称
    if (context.isInsideVar) {
      return 'name-only';
    }

    // 在 CSS 变量定义位置，只插入名称
    if (context.isCssVarDefinition) {
      return 'name-only';
    }

    // 其他位置，插入完整的 var() 语法
    return 'full';
  }
}
