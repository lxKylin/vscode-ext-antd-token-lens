/**
 * CSS 解析器
 * 用于从 CSS 文件中提取 CSS 变量（Custom Properties）
 */

export interface CSSVariable {
  name: string;
  value: string;
}

/**
 * 从 CSS 内容中解析所有 CSS 变量
 * @param cssContent CSS 文件内容
 * @returns CSS 变量数组
 */
export function parseCSSVariables(cssContent: string): CSSVariable[] {
  const variables: CSSVariable[] = [];

  // 移除 CSS 注释
  const contentWithoutComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

  // 匹配 CSS 变量定义的正则表达式
  // 格式: --variable-name: value;
  const variableRegex = /--([\w-]+)\s*:\s*([^;]+);/g;

  let match;
  while ((match = variableRegex.exec(contentWithoutComments)) !== null) {
    const name = `--${match[1]}`;
    const value = match[2].trim();

    variables.push({ name, value });
  }

  return variables;
}

/**
 * 从 CSS 内容中解析指定选择器内的 CSS 变量
 * @param cssContent CSS 文件内容
 * @param selector CSS 选择器，如 ':root', '.css-var-root'
 * @returns CSS 变量数组
 */
export function parseCSSVariablesFromSelector(
  cssContent: string,
  selector: string = ':root'
): CSSVariable[] {
  const variables: CSSVariable[] = [];

  // 移除 CSS 注释
  const contentWithoutComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

  // 匹配选择器块的正则表达式
  const selectorRegex = new RegExp(
    `${escapeRegExp(selector)}\\s*\\{([^}]+)\\}`,
    'g'
  );

  let selectorMatch;
  while (
    (selectorMatch = selectorRegex.exec(contentWithoutComments)) !== null
  ) {
    const blockContent = selectorMatch[1];

    // 在块内容中匹配 CSS 变量
    const variableRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
    let variableMatch;

    while ((variableMatch = variableRegex.exec(blockContent)) !== null) {
      const name = `--${variableMatch[1]}`;
      const value = variableMatch[2].trim();

      variables.push({ name, value });
    }
  }

  return variables;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 批量解析多个选择器
 * @param cssContent CSS 文件内容
 * @param selectors 选择器数组
 * @returns CSS 变量数组（去重）
 */
export function parseCSSVariablesFromSelectors(
  cssContent: string,
  selectors: string[]
): CSSVariable[] {
  const variablesMap = new Map<string, string>();

  for (const selector of selectors) {
    const variables = parseCSSVariablesFromSelector(cssContent, selector);

    // 合并变量，后面的覆盖前面的
    for (const variable of variables) {
      variablesMap.set(variable.name, variable.value);
    }
  }

  return Array.from(variablesMap.entries()).map(([name, value]) => ({
    name,
    value
  }));
}
