import pinyin from 'pinyin';

/**
 * 拼音搜索工具类
 */
export class PinyinSearch {
  private static pinyinCache = new Map<string, string>();

  /**
   * 获取文本的拼音首字母
   */
  static getInitials(text: string): string {
    if (this.pinyinCache.has(text)) {
      return this.pinyinCache.get(text)!;
    }

    const result = pinyin(text, {
      style: pinyin.STYLE_FIRST_LETTER
    })
      .map((item) => item[0])
      .join('');

    this.pinyinCache.set(text, result);
    return result;
  }

  /**
   * 获取文本的完整拼音
   */
  static getFullPinyin(text: string): string {
    return pinyin(text, {
      style: pinyin.STYLE_NORMAL
    })
      .map((item) => item[0])
      .join('');
  }

  /**
   * 检查是否匹配（拼音首字母）
   */
  static matchInitials(text: string, query: string): boolean {
    const initials = this.getInitials(text).toLowerCase();
    const lowerQuery = query.toLowerCase();

    return initials.includes(lowerQuery);
  }

  /**
   * 检查是否匹配（完整拼音）
   */
  static matchFull(text: string, query: string): boolean {
    const fullPinyin = this.getFullPinyin(text).toLowerCase();
    const lowerQuery = query.toLowerCase();

    return fullPinyin.includes(lowerQuery);
  }

  /**
   * 清空缓存
   */
  static clearCache(): void {
    this.pinyinCache.clear();
  }
}
