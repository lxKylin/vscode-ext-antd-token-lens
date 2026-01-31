import Color from 'color';

export interface ColorFormats {
  hex: string;
  rgb: string;
  rgba: string;
  hsl: string;
  hsla: string;
  hsv: string;
}

/**
 * 颜色转换工具类
 * 提供颜色格式转换、亮度计算等功能
 */
export class ColorConverter {
  /**
   * 转换颜色到所有常用格式
   * @param colorValue 颜色值（支持多种输入格式）
   * @returns 所有格式的颜色值
   */
  static convertToAllFormats(colorValue: string): ColorFormats | null {
    try {
      const color = Color(colorValue);

      return {
        hex: color.hex(),
        rgb: color.rgb().string(),
        rgba: color.rgb().alpha(color.alpha()).string(),
        hsl: color.hsl().string(),
        hsla: color.hsl().alpha(color.alpha()).string(),
        hsv: `hsv(${Math.round(color.hue())}, ${Math.round(color.saturationv())}%, ${Math.round(color.value())}%)`
      };
    } catch (error) {
      console.error('Color conversion failed:', error);
      return null;
    }
  }

  /**
   * 检查是否为有效颜色
   */
  static isValidColor(colorValue: string): boolean {
    try {
      Color(colorValue);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 计算颜色亮度
   */
  static getLuminance(colorValue: string): number {
    try {
      return Color(colorValue).luminosity();
    } catch {
      return 0;
    }
  }

  /**
   * 判断颜色是深色还是浅色
   */
  static isDark(colorValue: string): boolean {
    return this.getLuminance(colorValue) < 0.5;
  }

  /**
   * 获取对比色（用于文字显示）
   */
  static getContrastColor(colorValue: string): string {
    return this.isDark(colorValue) ? '#ffffff' : '#000000';
  }

  /**
   * 调整颜色透明度
   */
  static adjustAlpha(colorValue: string, alpha: number): string {
    try {
      return Color(colorValue).alpha(alpha).string();
    } catch {
      return colorValue;
    }
  }
}
