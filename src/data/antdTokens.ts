/**
 * Ant Design Token 数据类型定义和数据加载模块
 */

/**
 * Token 分类类型
 */
export type TokenCategory =
  | 'color'
  | 'size'
  | 'font'
  | 'line'
  | 'motion'
  | 'shadow'
  | 'zIndex'
  | 'opacity'
  | 'other';

/**
 * Token 信息接口
 */
export interface TokenInfo {
  /** Token 名称，如 '--ant-color-primary' */
  name: string;
  /** Token 值，如 '#1677ff' */
  value: string;
  /** 主题类型 */
  theme: 'light' | 'dark';
  /** Token 分类 */
  category: TokenCategory;
  /** Token 语义说明 */
  description?: string;
  /** Token 来源 */
  source: 'builtin' | 'custom';
  /** 是否为颜色类型 */
  isColor: boolean;
}

/**
 * 主题 Token 集合
 */
export interface ThemeTokens {
  light: TokenInfo[];
  dark: TokenInfo[];
}

/**
 * 判断值是否为颜色
 * 支持 hex、rgb、rgba、hsl、hsla 等格式
 */
export function isColorValue(value: string): boolean {
  const trimmedValue = value.trim();

  // Hex 颜色: #fff, #ffffff, #ffffffff
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmedValue)) {
    return true;
  }

  // RGB/RGBA: rgb(255, 255, 255), rgba(255, 255, 255, 0.5)
  if (/^rgba?\([\d\s,./]+\)$/i.test(trimmedValue)) {
    return true;
  }

  // HSL/HSLA: hsl(0, 0%, 100%), hsla(0, 0%, 100%, 0.5)
  if (/^hsla?\([\d\s,%./]+\)$/i.test(trimmedValue)) {
    return true;
  }

  // CSS 颜色关键字（常见的）
  const colorKeywords = [
    'transparent',
    'currentcolor',
    'inherit',
    'initial',
    'unset',
    'black',
    'white',
    'red',
    'green',
    'blue',
    'yellow',
    'cyan',
    'magenta',
    'gray',
    'grey',
    'orange',
    'purple',
    'pink',
    'brown'
  ];
  if (colorKeywords.includes(trimmedValue.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * 根据 Token 名称推断分类
 */
export function inferTokenCategory(name: string): TokenCategory {
  const lowerName = name.toLowerCase();

  // 颜色相关
  if (
    lowerName.includes('color') ||
    lowerName.includes('blue') ||
    lowerName.includes('red') ||
    lowerName.includes('green') ||
    lowerName.includes('orange') ||
    lowerName.includes('purple') ||
    lowerName.includes('cyan') ||
    lowerName.includes('magenta') ||
    lowerName.includes('yellow') ||
    lowerName.includes('pink') ||
    lowerName.includes('volcano') ||
    lowerName.includes('geekblue') ||
    lowerName.includes('gold') ||
    lowerName.includes('lime') ||
    lowerName.match(/-\d+$/) // 颜色梯度，如 --ant-blue-1
  ) {
    return 'color';
  }

  // 尺寸相关
  if (
    lowerName.includes('size') ||
    lowerName.includes('width') ||
    lowerName.includes('height') ||
    lowerName.includes('padding') ||
    lowerName.includes('margin') ||
    lowerName.includes('radius') ||
    lowerName.includes('control')
  ) {
    return 'size';
  }

  // 字体相关
  if (lowerName.includes('font')) {
    return 'font';
  }

  // 线条相关
  if (lowerName.includes('line') || lowerName.includes('border')) {
    return 'line';
  }

  // 动画相关
  if (lowerName.includes('motion') || lowerName.includes('duration')) {
    return 'motion';
  }

  // 阴影相关
  if (lowerName.includes('shadow')) {
    return 'shadow';
  }

  // 层级相关
  if (lowerName.includes('z-index')) {
    return 'zIndex';
  }

  // 透明度相关
  if (lowerName.includes('opacity')) {
    return 'opacity';
  }

  return 'other';
}

/**
 * 加载内置的 Ant Design Token
 */
export function loadBuiltinTokens(): ThemeTokens {
  const fs = require('fs');
  const path = require('path');
  const {
    parseCSSVariablesFromSelectors
  } = require('../tokenManager/cssParser');
  const { getTokenDescription } = require('./tokenMetadata');

  // 获取 CSS 文件路径
  const lightCssPath = path.join(
    __dirname,
    '../assets/css/antd-light-theme.css'
  );
  const darkCssPath = path.join(__dirname, '../assets/css/antd-dark-theme.css');

  // 读取 CSS 文件内容
  const lightCssContent = fs.readFileSync(lightCssPath, 'utf-8');
  const darkCssContent = fs.readFileSync(darkCssPath, 'utf-8');

  // 解析 CSS 变量（支持多种选择器）
  const lightVariables: { name: string; value: string }[] =
    parseCSSVariablesFromSelectors(lightCssContent, [
      ':root',
      '.css-var-root',
      '.qz-css-var'
    ]);

  const darkVariables: { name: string; value: string }[] =
    parseCSSVariablesFromSelectors(darkCssContent, [
      ':root',
      '.css-var-root',
      '.qz-css-var'
    ]);

  // 转换为 TokenInfo
  const lightTokens: TokenInfo[] = lightVariables.map((variable) => {
    const category = inferTokenCategory(variable.name);
    const isColor = isColorValue(variable.value);

    return {
      name: variable.name,
      value: variable.value,
      theme: 'light',
      category,
      description: getTokenDescription(variable.name),
      source: 'builtin',
      isColor
    };
  });

  const darkTokens: TokenInfo[] = darkVariables.map((variable) => {
    const category = inferTokenCategory(variable.name);
    const isColor = isColorValue(variable.value);

    return {
      name: variable.name,
      value: variable.value,
      theme: 'dark',
      category,
      description: getTokenDescription(variable.name),
      source: 'builtin',
      isColor
    };
  });

  return {
    light: lightTokens,
    dark: darkTokens
  };
}
