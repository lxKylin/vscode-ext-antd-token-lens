// src/utils/jsTokenAliasDetector.ts

/**
 * 自动检测 JS/TS 文件中 useToken() 解构出的 token 变量别名
 *
 * 支持以下模式：
 * - const { token } = useToken()              → ["token"]
 * - const { token: antdToken } = useToken()   → ["antdToken"]
 * - const { token: t } = theme.useToken()     → ["t"]
 * - const { token, hashId } = useToken()      → ["token"]
 */
export class JsTokenAliasDetector {
  /** 匹配 useToken() 解构赋值（不跨越嵌套大括号） */
  private static readonly USE_TOKEN_PATTERN =
    /\{([^{}]*)\}\s*=\s*(?:[\w.]+\.)?useToken\s*\(/g;

  /** 在解构体中匹配 token 或 token: alias */
  private static readonly TOKEN_ALIAS_PATTERN =
    /\btoken\s*(?::\s*([a-zA-Z_$][\w$]*))?/;

  /**
   * 从文档内容中检测 token 变量名
   * @param documentText 文档全文
   * @returns 检测到的标识符数组，如果未检测到则返回 ["token"]
   */
  static detect(documentText: string): string[] {
    const aliases: string[] = [];

    const pattern = new RegExp(this.USE_TOKEN_PATTERN.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(documentText)) !== null) {
      const destructuredContent = match[1];
      const tokenMatch = this.TOKEN_ALIAS_PATTERN.exec(destructuredContent);
      if (tokenMatch) {
        aliases.push(tokenMatch[1] || 'token');
      }
    }

    // 去重
    const unique = [...new Set(aliases)];
    return unique.length > 0 ? unique : ['token'];
  }

  /**
   * 将标识符列表构建为正则交替组
   * @example ["token"] → "token"
   * @example ["token", "antdToken"] → "(?:token|antdToken)"
   */
  static buildIdentifierGroup(identifiers: string[]): string {
    if (identifiers.length === 1) {
      return identifiers[0];
    }
    return `(?:${identifiers.join('|')})`;
  }
}
