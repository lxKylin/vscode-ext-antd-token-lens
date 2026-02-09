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

/**
 * CSS Parser 类（支持变量提取和引用解析）
 */
export class CSSParser {
  /**
   * 从 CSS 内容中提取所有 CSS 变量
   */
  extractVariables(content: string): Record<string, string> {
    const variables: Record<string, string> = {};

    // 移除 CSS 注释
    const contentWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');

    // 匹配 :root 或其他选择器中的 CSS 变量定义
    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    let ruleMatch;

    while ((ruleMatch = ruleRegex.exec(contentWithoutComments)) !== null) {
      const selector = ruleMatch[1].trim();
      const declarations = ruleMatch[2];

      // 只处理 :root 或包含 data-theme 的选择器
      if (
        selector === ':root' ||
        selector.includes('[data-theme') ||
        selector.includes('.theme-') ||
        selector.includes('.dark') ||
        selector.includes('.light')
      ) {
        // 提取变量定义
        const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
        let varMatch;

        while ((varMatch = varRegex.exec(declarations)) !== null) {
          const varName = '--' + varMatch[1];
          const varValue = varMatch[2].trim();

          // 暂时保存所有变量（包括引用其他变量的）
          variables[varName] = varValue;
        }
      }
    }

    return variables;
  }

  /**
   * 解析 CSS 变量的引用链
   */
  resolveVariableReferences(
    variables: Record<string, string>
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    const maxDepth = 10; // 防止循环引用

    for (const [name, value] of Object.entries(variables)) {
      resolved[name] = this.resolveValue(value, variables, 0, maxDepth);
    }

    return resolved;
  }

  private resolveValue(
    value: string,
    variables: Record<string, string>,
    depth: number,
    maxDepth: number
  ): string {
    if (depth >= maxDepth) {
      return value;
    }

    // 匹配 var(--xxx) 引用
    const varRefRegex = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g;

    return value.replace(varRefRegex, (match, refName, fallback) => {
      const refValue = variables[refName];

      if (refValue) {
        // 递归解析引用
        return this.resolveValue(refValue, variables, depth + 1, maxDepth);
      } else if (fallback) {
        return fallback.trim();
      } else {
        return match; // 保持原样
      }
    });
  }
}
