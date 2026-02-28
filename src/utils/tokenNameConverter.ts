// src/utils/tokenNameConverter.ts

/**
 * Token 命名转换工具
 * 负责 JS camelCase 名称与 CSS 变量名之间的互转
 */
export class TokenNameConverter {
  /**
   * 将 JS camelCase 名称转换为 CSS 变量名
   * @param jsName JS camelCase 名称，如 colorPrimary
   * @param prefix CSS 变量前缀，默认 '--ant-'
   * @returns CSS 变量名，如 --ant-color-primary
   */
  static jsToCss(jsName: string, prefix: string = '--ant-'): string {
    const kebab = TokenNameConverter.camelToKebab(jsName);
    return `${prefix}${kebab}`;
  }

  /**
   * 将 CSS 变量名转换为 JS camelCase 名称
   * @param cssName CSS 变量名，如 --ant-color-primary
   * @returns JS camelCase 名称，如 colorPrimary
   */
  static cssToJs(cssName: string): string {
    // 去除 --ant- 或 -- 前缀
    const withoutPrefix = cssName.replace(/^--(?:ant-)?/, '');
    return TokenNameConverter.kebabToCamel(withoutPrefix);
  }

  /**
   * 将 camelCase 字符串转换为 kebab-case
   * @param str camelCase 字符串，如 colorPrimary
   * @returns kebab-case 字符串，如 color-primary
   */
  static camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  /**
   * 将 kebab-case 字符串转换为 camelCase
   * @param str kebab-case 字符串，如 color-primary
   * @returns camelCase 字符串，如 colorPrimary
   */
  static kebabToCamel(str: string): string {
    return str.replace(/-([a-zA-Z])/g, (_, char: string) => char.toUpperCase());
  }
}
