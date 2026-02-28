// src/tokenManager/jsTokenScanner.ts
import * as vscode from 'vscode';
import { TokenMatch } from './tokenScanner';
import { TokenRegistry } from './tokenRegistry';
import { ThemeManager } from './themeManager';
import { TokenNameConverter } from '@/utils/tokenNameConverter';

/**
 * JS/TS Token 扫描器
 * 负责从 JS/TS 文档中识别 token.xxx / theme.xxx 属性访问模式
 */
export class JsTokenScanner {
  /** 匹配 token.xxx 或 theme.xxx 属性访问模式的正则（源字符串，用于每次构造避免全局状态问题） */
  private static readonly PROPERTY_PATTERN =
    /\b(token|theme)\.([a-zA-Z][a-zA-Z0-9]*)\b/g;

  /** 支持的语言类型 */
  private static readonly SUPPORTED_LANGUAGES = [
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact'
  ];

  /** 注释行匹配正则：单行注释 // 或块注释行 * */
  private static readonly COMMENT_LINE_PATTERN = /^\s*\/\/|^\s*\*/;

  /** 扫描结果缓存 */
  private readonly cache = new Map<
    string,
    { version: number; matches: TokenMatch[] }
  >();

  constructor(
    private readonly tokenRegistry: TokenRegistry,
    private readonly themeManager: ThemeManager
  ) {}

  /**
   * 扫描文档中所有 token.xxx / theme.xxx 格式的 Antd Token 引用
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
   * 判断文档是否为支持的语言类型
   * @param document 文档
   * @returns 是否支持
   */
  isSupportedDocument(document: vscode.TextDocument): boolean {
    return JsTokenScanner.SUPPORTED_LANGUAGES.includes(document.languageId);
  }

  /**
   * 清除缓存
   * @param uri 指定 URI 清除对应缓存，不传则清除全部
   */
  clearCache(uri?: string): void {
    if (uri !== undefined) {
      this.cache.delete(uri);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 执行文档扫描
   * @param document 文档
   * @returns Token 匹配结果数组
   */
  private performScan(document: vscode.TextDocument): TokenMatch[] {
    const matches: TokenMatch[] = [];

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const lineText = document.lineAt(lineNum).text;

      // 跳过注释行
      if (JsTokenScanner.COMMENT_LINE_PATTERN.test(lineText)) {
        continue;
      }

      // 使用 PROPERTY_PATTERN 的 source 构造新正则，避免全局正则状态问题
      const pattern = new RegExp(JsTokenScanner.PROPERTY_PATTERN.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(lineText)) !== null) {
        const camelName = match[2];
        const cssName = TokenNameConverter.jsToCss(camelName);

        // 过滤 Registry 中不存在的 token
        if (!this.tokenRegistry.has(cssName)) {
          continue;
        }

        const startIndex = match.index;
        const fullMatch = match[0];

        // camelCase 名称在行中的起始位置（跳过 "token." 或 "theme." 前缀）
        const tokenStart = startIndex + fullMatch.lastIndexOf(camelName);
        const tokenEnd = tokenStart + camelName.length;

        matches.push({
          tokenName: cssName,
          fullMatch,
          range: new vscode.Range(
            new vscode.Position(lineNum, startIndex),
            new vscode.Position(lineNum, startIndex + fullMatch.length)
          ),
          tokenRange: new vscode.Range(
            new vscode.Position(lineNum, tokenStart),
            new vscode.Position(lineNum, tokenEnd)
          )
        });
      }
    }

    return matches;
  }
}
