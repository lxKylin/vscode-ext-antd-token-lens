import * as vscode from 'vscode';

export interface TriggerContext {
  isInsideVar: boolean; // 是否在 var() 内部
  isCssVarDefinition: boolean; // 是否在 CSS 变量定义位置
  isInsideTailwindClass: boolean; // 是否在 Tailwind 类名中（如 bg-(--xx)）
  filterText: string; // 已输入的过滤文本
  shouldComplete: boolean; // 是否应该触发补全
  replaceRange?: vscode.Range; // 需要替换的文本范围
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

    // 检查是否在 Tailwind 类名中（如 bg-(--xx)）
    const isInsideTailwindClass = this.isInsideTailwindClass(textBeforeCursor);

    // 提取过滤文本
    const filterText = this.extractFilterText(textBeforeCursor);

    // 计算替换范围
    const replaceRange = this.calculateReplaceRange(position, textBeforeCursor);

    // 判断是否应该触发补全
    const shouldComplete = this.shouldTriggerCompletion(
      textBeforeCursor,
      context,
      isInsideVar,
      isCssVarDefinition,
      isInsideTailwindClass
    );

    return {
      isInsideVar,
      isCssVarDefinition,
      isInsideTailwindClass,
      filterText,
      shouldComplete,
      replaceRange
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
   * 检查是否在 Tailwind 类名中（如 bg-(--xx)）
   * 匹配格式：[属性-(--变量)] 或 [属性-[...-(--变量)...]]
   */
  private static isInsideTailwindClass(text: string): boolean {
    // 匹配 [(...]( 之后但 ) 未闭合的位置，且其中包含 --
    // 例如：bg-(--primary  或  hover:bg-[...-(--primary
    const tailwindMatch = text.match(/\([^)]*--[\w-]*$/);
    return tailwindMatch !== null;
  }

  /**
   * 提取过滤文本
   * 支持两种格式：
   * 1. var(--xxx) 格式：--color-primary
   * 2. Tailwind 类中的 (--xxx) 格式：bg-(--primary)
   */
  private static extractFilterText(text: string): string {
    // 先尝试匹配标准的 -- 前缀格式
    const match = text.match(/--(?:ant-?)?[\w-]*$/);
    if (match) {
      return match[0];
    }

    // 返回空字符串如果没有匹配
    return '';
  }

  /**
   * 计算替换范围
   * 支持两种场景：
   * 1. var(--xxx) 中 -- 开始到末尾的部分
   * 2. Tailwind 类中 bg-(--xxx) 中 -- 开始到末尾的部分
   */
  private static calculateReplaceRange(
    position: vscode.Position,
    textBeforeCursor: string
  ): vscode.Range | undefined {
    // 匹配已输入的 CSS 变量名称部分（包括 -- 前缀和后续字符）
    const match = textBeforeCursor.match(/--(?:ant-?)?[\w-]*$/);

    if (!match) {
      return undefined;
    }

    const matchedText = match[0];
    const startCharacter = position.character - matchedText.length;
    const endCharacter = position.character;

    return new vscode.Range(
      new vscode.Position(position.line, startCharacter),
      new vscode.Position(position.line, endCharacter)
    );
  }

  /**
   * 判断是否应该触发补全
   */
  private static shouldTriggerCompletion(
    textBeforeCursor: string,
    context: vscode.CompletionContext,
    isInsideVar: boolean,
    isCssVarDefinition: boolean,
    isInsideTailwindClass: boolean
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
      // 仅在 var()、CSS 变量定义位置或 Tailwind 类中继续触发
      if (isInsideVar && /--[\w-]*$/.test(textBeforeCursor)) {
        return true;
      }
      if (isCssVarDefinition && /--[\w-]*$/.test(textBeforeCursor)) {
        return true;
      }
      if (isInsideTailwindClass && /--[\w-]*$/.test(textBeforeCursor)) {
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

      // 输入 ( 且符合 Tailwind 类模式（如 bg-(），要求 ( 前面紧跟 -
      if (triggerChar === '(' && /-\($/.test(textBeforeCursor)) {
        return true;
      }

      // 输入字母、数字、下划线时，检查是否在有效的上下文中
      if (triggerChar && /[a-z0-9_-]/i.test(triggerChar)) {
        // 在 var() 内且已有 -- 前缀
        if (isInsideVar && /--[\w-]*$/.test(textBeforeCursor)) {
          return true;
        }
        // 在 CSS 变量定义位置且已有 -- 前缀
        if (isCssVarDefinition && /--[\w-]*$/.test(textBeforeCursor)) {
          return true;
        }
        // 在 Tailwind 类中且已有 -- 前缀
        if (isInsideTailwindClass && /--[\w-]*$/.test(textBeforeCursor)) {
          return true;
        }
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

    // 5. 如果在 Tailwind 类中且输入了自定义属性前缀（--）
    if (isInsideTailwindClass && /--[\w-]*$/.test(textBeforeCursor)) {
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

    // 在 Tailwind 类中，只插入名称
    if (context.isInsideTailwindClass) {
      return 'name-only';
    }

    // 其他位置，插入完整的 var() 语法
    return 'full';
  }
}
