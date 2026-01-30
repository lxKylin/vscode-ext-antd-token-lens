/**
 * 颜色对比度计算工具
 * 基于 WCAG 2.0 标准实现
 * 参考: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *
 * 改编自 vscode-ext-color-highlight 插件
 * https://github.com/enyancc/vscode-ext-color-highlight/blob/main/src/lib/dynamic-contrast.js
 */

/**
 * Convert an 8-bit color component from sRGB space (the default web color space)
 * into the linear RGB color space.
 *
 * @param c8 An 8-bit integer color channel in the sRGB color space (0-255)
 * @returns The value of the channel in a linear RGB color space (0.0-1.0)
 */
const srgb8ToLinear = (() => {
  // Lookup table for performance (256 possible values)
  const srgbLookupTable = new Float64Array(256);
  for (let i = 0; i < 256; ++i) {
    const c = i / 255.0;
    srgbLookupTable[i] =
      c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  return function (c8: number): number {
    // Clamp input to [0, 255]
    const index = Math.min(Math.max(c8, 0), 255) & 0xff;
    return srgbLookupTable[index];
  };
})();

/**
 * Compute the relative luminance of a color, using the algorithm from WCAG 2.0
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *
 * @param r8 The red component, as an 8-bit integer (0-255)
 * @param g8 The green component, as an 8-bit integer (0-255)
 * @param b8 The blue component, as an 8-bit integer (0-255)
 * @returns The relative luminance of the color, a number between 0.0 and 1.0
 */
function relativeLuminance(r8: number, g8: number, b8: number): number {
  const bigR = srgb8ToLinear(r8);
  const bigG = srgb8ToLinear(g8);
  const bigB = srgb8ToLinear(b8);
  return 0.2126 * bigR + 0.7152 * bigG + 0.0722 * bigB;
}

/**
 * Compute the contrast ratio between two relative luminances, using the
 * algorithm from WCAG 2.0: https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 *
 * @param l1 The relative luminance of the first color (0.0-1.0)
 * @param l2 The relative luminance of the second color (0.0-1.0)
 * @returns The contrast ratio between the input colors (1.0-21.0)
 */
function contrastRatio(l1: number, l2: number): number {
  // The denominator must be the darker (lower luminance) color
  if (l2 < l1) {
    return (0.05 + l1) / (0.05 + l2);
  } else {
    return (0.05 + l2) / (0.05 + l1);
  }
}

/**
 * Return suggested contrast text color (black or white) for the given background color.
 * Uses WCAG 2.0 definitions of relative luminance and contrast ratio.
 *
 * @param color A valid hex or rgb value, examples:
 *              - #000, #000000, 000, 000000
 *              - rgb(255, 255, 255), rgba(255, 255, 255, 1)
 * @returns A string of the form #RRGGBB (#000000 or #FFFFFF)
 */
export function getColorContrast(color: string): string {
  let r = 0,
    g = 0,
    b = 0;

  // Parse RGB from rgb/rgba format
  const rgbMatch = color.match(
    /^rgba?\s*\(\s*([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\s*(?:,\s*[\d.]+\s*)?\)/i
  );

  if (rgbMatch) {
    r = parseInt(rgbMatch[1], 10);
    g = parseInt(rgbMatch[2], 10);
    b = parseInt(rgbMatch[3], 10);
  } else {
    // Parse hex color
    let hex = color;
    if (hex.startsWith('#')) {
      hex = hex.substring(1);
    }

    if (hex.length === 3) {
      // Expand shorthand #abc to #aabbcc
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      // Invalid color format, default to black text
      return '#000000';
    }
  }

  // The color with the maximum contrast ratio to our input color is guaranteed
  // to be either white or black, so we just check both and pick whichever has
  // a higher contrast ratio.

  const luminance = relativeLuminance(r, g, b);

  // White has luminance 1.0, black has luminance 0.0 (by definition)
  const luminanceWhite = 1.0;
  const luminanceBlack = 0.0;

  const contrastWhite = contrastRatio(luminance, luminanceWhite);
  const contrastBlack = contrastRatio(luminance, luminanceBlack);

  if (contrastWhite > contrastBlack) {
    return '#FFFFFF';
  } else {
    return '#000000';
  }
}
