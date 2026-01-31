import Color = require('color');

/**
 * 颜色对比度计算工具
 * 基于 WCAG 2.0 标准实现，使用 color 库进行计算
 */

/**
 * 颜色对比度工具类
 * 提供颜色对比度计算和 WCAG 标准检查
 */
export class ColorContrast {
  /**
   * 计算两个颜色的对比度
   * @param color1 颜色1
   * @param color2 颜色2
   * @returns 对比度值 (1-21)
   */
  static calculateContrast(color1: string, color2: string): number {
    try {
      const c1 = Color(color1);
      const c2 = Color(color2);
      return c1.contrast(c2);
    } catch {
      return 1;
    }
  }

  /**
   * 检查对比度是否符合 WCAG 标准
   * @param color1 前景色
   * @param color2 背景色
   * @param level 'AA' | 'AAA'
   * @param textSize 'normal' | 'large'
   */
  static meetsWCAG(
    color1: string,
    color2: string,
    level: 'AA' | 'AAA' = 'AA',
    textSize: 'normal' | 'large' = 'normal'
  ): boolean {
    const contrast = this.calculateContrast(color1, color2);

    const thresholds = {
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 }
    };

    return contrast >= thresholds[level][textSize];
  }

  /**
   * 获取对比度等级标签
   */
  static getContrastLabel(contrast: number): string {
    if (contrast >= 7) {
      return '优秀 (AAA)';
    }
    if (contrast >= 4.5) {
      return '良好 (AA)';
    }
    if (contrast >= 3) {
      return '一般 (AA Large)';
    }
    return '不佳';
  }
}

/**
 * Return suggested contrast text color (black or white) for the given background color.
 * Uses WCAG 2.0 definitions of relative luminance and contrast ratio.
 *
 * @param color A valid color value (hex, rgb, etc.)
 * @returns A string of the form #RRGGBB (#000000 or #FFFFFF)
 */
export function getColorContrast(color: string): string {
  try {
    const c = Color(color);
    const luminance = c.luminosity();

    // 计算与黑白色的对比度
    const contrastWhite = c.contrast(Color('#FFFFFF'));
    const contrastBlack = c.contrast(Color('#000000'));

    if (contrastWhite > contrastBlack) {
      return '#FFFFFF';
    } else {
      return '#000000';
    }
  } catch {
    // 解析失败，默认返回黑色
    return '#000000';
  }
}
