import * as vscode from 'vscode';

/**
 * Token 匹配结果
 */
export interface TokenMatch {
  /** Token 名称，如 --ant-color-primary */
  tokenName: string;
  /** 在文档中的位置范围（整个 var() 表达式） */
  range: vscode.Range;
  /** Token 名称在文档中的位置范围（仅 token 名称部分） */
  tokenRange: vscode.Range;
  /** 完整匹配文本，如 var(--ant-color-primary) */
  fullMatch: string;
}

/**
 * Token 扫描器
 * 负责从文档中识别并提取所有 var(--*) 格式的 CSS 变量
 * 支持任意前缀的 CSS 变量，包括 --ant-、--el-、--my- 等
 */
export class TokenScanner {
  /** 匹配 var(--xxx) 格式的正则表达式，支持任意前缀 */
  private static readonly CSS_VAR_PATTERN =
    /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*[^)]+)?\)/g;

  /** CSS 注释匹配正则 */
  private static readonly COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

  /** 支持的语言类型 */
  private static readonly SUPPORTED_LANGUAGES = [
    'css',
    'less',
    'scss',
    'sass',
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact',
    'vue',
    'html',
    'markdown'
  ];

  /** 扫描结果缓存 */
  private cache = new Map<string, { version: number; matches: TokenMatch[] }>();

  /**
   * 扫描文档中的所有 Ant Design Token
   * @param document 要扫描的文档
   * @returns Token 匹配结果数组
   */
  scanDocument(document: vscode.TextDocument): TokenMatch[] {
    const uri = document.uri.toString();
    const cached = this.cache.get(uri);

    // 如果文档未变更，返回缓存
    if (cached && cached.version === document.version) {
      return cached.matches;
    }

    // 执行扫描
    const matches = this.performScan(document);

    // 更新缓存
    this.cache.set(uri, { version: document.version, matches });

    return matches;
  }

  /**
   * 扫描文档指定范围
   * @param document 文档
   * @param range 扫描范围（用于增量更新）
   * @returns Token 匹配结果数组
   */
  scanRange(document: vscode.TextDocument, range: vscode.Range): TokenMatch[] {
    const matches: TokenMatch[] = [];

    for (
      let lineNumber = range.start.line;
      lineNumber <= range.end.line;
      lineNumber++
    ) {
      if (lineNumber >= document.lineCount) {
        break;
      }
      const line = document.lineAt(lineNumber);
      matches.push(...this.scanLine(line.text, lineNumber));
    }

    return matches;
  }

  /**
   * 扫描单行文本
   * @param text 文本内容
   * @param lineNumber 行号
   * @returns Token 匹配结果数组
   */
  scanLine(text: string, lineNumber: number): TokenMatch[] {
    const matches: TokenMatch[] = [];

    // 移除注释（避免匹配注释中的 token）
    const textWithoutComments = this.removeComments(text);

    // 创建新的正则实例（因为使用了 g 标志）
    const pattern = new RegExp(TokenScanner.CSS_VAR_PATTERN, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(textWithoutComments)) !== null) {
      const fullMatch = match[0];
      const tokenName = match[1];
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      // 计算 token 名称在原文中的位置
      // var(--ant-color-primary) 中 --ant-color-primary 的位置
      const tokenStartInMatch = fullMatch.indexOf(tokenName);
      const tokenStartIndex = startIndex + tokenStartInMatch;
      const tokenEndIndex = tokenStartIndex + tokenName.length;

      matches.push({
        tokenName,
        fullMatch,
        range: new vscode.Range(
          new vscode.Position(lineNumber, startIndex),
          new vscode.Position(lineNumber, endIndex)
        ),
        tokenRange: new vscode.Range(
          new vscode.Position(lineNumber, tokenStartIndex),
          new vscode.Position(lineNumber, tokenEndIndex)
        )
      });
    }

    return matches;
  }

  /**
   * 检查文档是否支持扫描
   * @param document 文档
   * @returns 是否支持
   */
  isSupportedDocument(document: vscode.TextDocument): boolean {
    return TokenScanner.SUPPORTED_LANGUAGES.includes(document.languageId);
  }

  /**
   * 清除缓存
   * @param uri 文档 URI（可选，不传则清除所有）
   */
  clearCache(uri?: string): void {
    if (uri) {
      this.cache.delete(uri);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 执行完整文档扫描
   * @param document 文档
   * @returns Token 匹配结果数组
   */
  private performScan(document: vscode.TextDocument): TokenMatch[] {
    const matches: TokenMatch[] = [];
    const lineCount = document.lineCount;

    for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber);
      matches.push(...this.scanLine(line.text, lineNumber));
    }

    return matches;
  }

  /**
   * 移除 CSS 注释
   * @param text 原始文本
   * @returns 移除注释后的文本
   */
  private removeComments(text: string): string {
    return text.replace(TokenScanner.COMMENT_PATTERN, '');
  }
}
