import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ts from 'typescript';
import { AntdThemeSourceConfig } from '../sourceTypes';
import {
  createWarning,
  SourceDiagnostic,
  SourceErrorCode,
  SourceErrorCodeValue,
  TokenSourceError
} from '../sourceDiagnostics';

export type ThemeConfigInputKind =
  | 'inlineThemeConfig'
  | 'inlineDesignToken'
  | 'file';

export type ThemeConfigEntryType = 'themeConfig' | 'designToken' | 'filePath';

export interface ThemeConfigLoadResult {
  themeConfig: Record<string, unknown>;
  sourceFile?: string;
  inputKind: ThemeConfigInputKind;
  entryType: ThemeConfigEntryType;
  resolvedFilePath?: string;
  usedExportName?: string;
  usedExportKind?: 'default' | 'named';
  warnings: SourceDiagnostic[];
}

export class ThemeConfigLoader {
  async load(config: AntdThemeSourceConfig): Promise<ThemeConfigLoadResult> {
    const warnings = this.collectWarnings(config);

    if (config.themeConfig !== undefined) {
      if (!isPlainObject(config.themeConfig)) {
        throw new TokenSourceError({
          code: SourceErrorCode.CONFIG_INVALID_THEME_CONFIG,
          message: 'themeConfig 必须是纯对象，不能是数组、函数或运行时值'
        });
      }

      return {
        themeConfig: { ...config.themeConfig },
        inputKind: 'inlineThemeConfig',
        entryType: 'themeConfig',
        warnings
      };
    }

    if (config.designToken !== undefined) {
      if (!isPlainObject(config.designToken)) {
        throw new TokenSourceError({
          code: SourceErrorCode.CONFIG_INVALID_DESIGN_TOKEN,
          message: 'designToken 必须是纯对象，不能是数组、函数或运行时值'
        });
      }

      return {
        themeConfig: {
          token: { ...config.designToken }
        },
        inputKind: 'inlineDesignToken',
        entryType: 'designToken',
        warnings
      };
    }

    if (!config.filePath) {
      throw new TokenSourceError({
        code: SourceErrorCode.CONFIG_MISSING_INPUT,
        message:
          'antdTheme 数据源缺少输入，请至少提供 themeConfig、designToken 或 filePath 之一'
      });
    }

    return this.loadFromFile(config.filePath, config.exportName, warnings);
  }

  private async loadFromFile(
    filePath: string,
    exportName?: string,
    warnings: SourceDiagnostic[] = []
  ): Promise<ThemeConfigLoadResult> {
    const extension = path.extname(filePath).toLowerCase();
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      throw new TokenSourceError({
        code:
          code === 'ENOENT'
            ? SourceErrorCode.FILE_NOT_FOUND
            : SourceErrorCode.FILE_ACCESS_DENIED,
        message:
          code === 'ENOENT'
            ? `主题文件不存在: ${filePath}`
            : `无法访问主题文件: ${filePath}`,
        metadata: {
          filePath,
          systemErrorCode: code
        },
        cause: error
      });
    }

    switch (extension) {
      case '.json':
        return {
          themeConfig: this.ensureThemeConfig(JSON.parse(content), filePath),
          sourceFile: filePath,
          inputKind: 'file',
          entryType: 'filePath',
          resolvedFilePath: filePath,
          usedExportName: 'default',
          usedExportKind: 'default',
          warnings
        };

      case '.js':
      case '.cjs':
      case '.mjs':
      case '.ts': {
        const extracted = this.extractThemeConfigFromModule(
          filePath,
          content,
          exportName
        );

        return {
          themeConfig: extracted.themeConfig,
          sourceFile: filePath,
          inputKind: 'file',
          entryType: 'filePath',
          resolvedFilePath: filePath,
          usedExportName: extracted.usedExportName,
          usedExportKind: extracted.usedExportKind,
          warnings
        };
      }

      default:
        throw new TokenSourceError({
          code: SourceErrorCode.FILE_UNSUPPORTED_EXTENSION,
          message: `不支持的主题文件类型: ${extension || 'unknown'}`,
          metadata: {
            extension,
            filePath
          }
        });
    }
  }

  private extractThemeConfigFromModule(
    filePath: string,
    content: string,
    exportName?: string
  ): {
    themeConfig: Record<string, unknown>;
    usedExportName: string;
    usedExportKind: 'default' | 'named';
  } {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.ES2022,
      true,
      this.getScriptKind(filePath)
    );

    const exportsMap = this.collectModuleExports(sourceFile);
    const matched = this.findPreferredExport(exportsMap, exportName);

    if (matched) {
      const extracted = extractLiteralValue(matched.expression, sourceFile);
      return {
        themeConfig: this.ensureThemeConfig(extracted, filePath, matched.key),
        usedExportName: matched.key,
        usedExportKind: matched.key === 'default' ? 'default' : 'named'
      };
    }

    throw new TokenSourceError({
      code: SourceErrorCode.EXPORT_NOT_FOUND,
      message: exportName
        ? `主题文件中未找到导出 ${exportName}`
        : '主题文件缺少可识别导出，请使用 export default、export const themeConfig、module.exports 或 exports.themeConfig',
      metadata: {
        filePath,
        exportName
      }
    });
  }

  private collectModuleExports(
    sourceFile: ts.SourceFile
  ): Map<string, ts.Expression> {
    const exportsMap = new Map<string, ts.Expression>();

    for (const statement of sourceFile.statements) {
      this.collectExportFromStatement(statement, exportsMap);
    }

    return exportsMap;
  }

  private collectExportFromStatement(
    statement: ts.Statement,
    exportsMap: Map<string, ts.Expression>
  ): void {
    if (ts.isExportAssignment(statement)) {
      exportsMap.set('default', statement.expression);
      return;
    }

    if (
      ts.isVariableStatement(statement) &&
      hasExportModifier(statement.modifiers)
    ) {
      this.collectVariableExports(statement, exportsMap);
      return;
    }

    if (!ts.isExpressionStatement(statement)) {
      return;
    }

    const assignment = this.getAssignmentExpression(statement.expression);
    if (!assignment) {
      return;
    }

    const exportKey = this.getCommonJsExportKey(assignment.left);
    if (exportKey) {
      exportsMap.set(exportKey, assignment.right);
    }
  }

  private collectVariableExports(
    statement: ts.VariableStatement,
    exportsMap: Map<string, ts.Expression>
  ): void {
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      exportsMap.set(declaration.name.text, declaration.initializer);
    }
  }

  private findPreferredExport(
    exportsMap: Map<string, ts.Expression>,
    exportName?: string
  ): { key: string; expression: ts.Expression } | undefined {
    const preferredKeys = exportName
      ? [exportName]
      : ['default', 'themeConfig', 'module.exports', 'exports.themeConfig'];

    for (const key of preferredKeys) {
      const expression = exportsMap.get(key);
      if (expression) {
        return { key, expression };
      }
    }

    return undefined;
  }

  private ensureThemeConfig(
    value: unknown,
    filePath: string,
    exportName?: string
  ): Record<string, unknown> {
    if (!isPlainObject(value)) {
      const suffix = exportName ? `（导出 ${exportName}）` : '';
      throw new TokenSourceError({
        code: SourceErrorCode.EXPORT_NOT_PLAIN_OBJECT,
        message: `主题配置${suffix} 必须是纯对象: ${filePath}`,
        metadata: {
          filePath,
          exportName
        }
      });
    }

    return value;
  }

  private collectWarnings(config: AntdThemeSourceConfig): SourceDiagnostic[] {
    const configuredFields: ThemeConfigEntryType[] = [];

    if (config.themeConfig !== undefined) {
      configuredFields.push('themeConfig');
    }
    if (config.designToken !== undefined) {
      configuredFields.push('designToken');
    }
    if (config.filePath) {
      configuredFields.push('filePath');
    }

    if (configuredFields.length <= 1) {
      return [];
    }

    const [activeEntryType, ...ignoredEntryTypes] = configuredFields;
    return [
      createWarning(
        SourceErrorCode.VALIDATION_FAILED,
        `检测到多个输入字段，实际采用 ${activeEntryType}，其余字段将被忽略`,
        {
          activeEntryType,
          ignoredEntryTypes
        }
      )
    ];
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case '.ts':
        return ts.ScriptKind.TS;
      case '.mjs':
      case '.cjs':
      case '.js':
        return ts.ScriptKind.JS;
      default:
        return ts.ScriptKind.Unknown;
    }
  }

  private getAssignmentExpression(
    expression: ts.Expression
  ): ts.BinaryExpression | undefined {
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      return expression;
    }

    return undefined;
  }

  private getCommonJsExportKey(left: ts.Expression): string | undefined {
    if (
      ts.isPropertyAccessExpression(left) &&
      ts.isIdentifier(left.expression) &&
      left.expression.text === 'module' &&
      left.name.text === 'exports'
    ) {
      return 'module.exports';
    }

    if (
      ts.isPropertyAccessExpression(left) &&
      ts.isIdentifier(left.expression) &&
      left.expression.text === 'exports'
    ) {
      return `exports.${left.name.text}`;
    }

    return undefined;
  }
}

function hasExportModifier(
  modifiers: ts.NodeArray<ts.ModifierLike> | undefined
): boolean {
  return !!modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );
}

function extractLiteralValue(
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): unknown {
  if (ts.isParenthesizedExpression(expression)) {
    return extractLiteralValue(expression.expression, sourceFile);
  }

  if (ts.isObjectLiteralExpression(expression)) {
    return extractObjectLiteralValue(expression, sourceFile);
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return extractArrayLiteralValue(expression, sourceFile);
  }

  const primitiveValue = extractPrimitiveLiteralValue(expression);
  if (primitiveValue !== undefined) {
    return primitiveValue;
  }

  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    throw createUnsupportedExpressionError(
      SourceErrorCode.EXPORT_IS_FUNCTION,
      'Function exports are not supported. Export a plain object instead',
      expression,
      sourceFile
    );
  }

  if (ts.isIdentifier(expression)) {
    throw createUnsupportedExpressionError(
      SourceErrorCode.EXPORT_UNSUPPORTED_EXPRESSION,
      `Identifier "${expression.text}" is not supported. Theme config files must export plain objects without runtime references`,
      expression,
      sourceFile
    );
  }

  throw createUnsupportedExpressionError(
    SourceErrorCode.EXPORT_UNSUPPORTED_EXPRESSION,
    `Unsupported theme config expression: ${ts.SyntaxKind[expression.kind]}`,
    expression,
    sourceFile
  );
}

function getPropertyName(
  propertyName: ts.PropertyName,
  sourceFile: ts.SourceFile
): string {
  if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName)) {
    return propertyName.text;
  }

  if (ts.isNumericLiteral(propertyName)) {
    return propertyName.text;
  }

  throw createUnsupportedExpressionError(
    SourceErrorCode.EXPORT_UNSUPPORTED_EXPRESSION,
    'Computed property names are not supported in theme config files',
    propertyName,
    sourceFile
  );
}

function createUnsupportedExpressionError(
  code: SourceErrorCodeValue,
  message: string,
  node: ts.Node,
  sourceFile: ts.SourceFile
): Error {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );

  return new TokenSourceError({
    code,
    message: `${message} (${path.basename(sourceFile.fileName)}:${line + 1}:${character + 1})`,
    metadata: {
      filePath: sourceFile.fileName,
      line: line + 1,
      character: character + 1
    }
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function extractObjectLiteralValue(
  expression: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const property of expression.properties) {
    if (ts.isSpreadAssignment(property)) {
      throw createUnsupportedExpressionError(
        SourceErrorCode.EXPORT_UNSUPPORTED_EXPRESSION,
        'Spread syntax is not supported in theme config files',
        property,
        sourceFile
      );
    }

    if (!ts.isPropertyAssignment(property)) {
      throw createUnsupportedExpressionError(
        SourceErrorCode.EXPORT_UNSUPPORTED_EXPRESSION,
        'Only plain object properties are supported in theme config files',
        property,
        sourceFile
      );
    }

    const propertyName = getPropertyName(property.name, sourceFile);
    result[propertyName] = extractLiteralValue(
      property.initializer,
      sourceFile
    );
  }

  return result;
}

function extractArrayLiteralValue(
  expression: ts.ArrayLiteralExpression,
  sourceFile: ts.SourceFile
): unknown[] {
  return expression.elements.map((element) => {
    if (ts.isSpreadElement(element)) {
      throw createUnsupportedExpressionError(
        SourceErrorCode.EXPORT_UNSUPPORTED_EXPRESSION,
        'Spread syntax is not supported in theme config arrays',
        element,
        sourceFile
      );
    }

    return extractLiteralValue(element, sourceFile);
  });
}

function extractPrimitiveLiteralValue(expression: ts.Expression): unknown {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text;
  }

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    return -Number(expression.operand.text);
  }

  return undefined;
}
