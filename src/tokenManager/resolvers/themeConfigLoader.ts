import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ts from 'typescript';
import { AntdThemeSourceConfig } from '../sourceTypes';

export interface ThemeConfigLoadResult {
  themeConfig: Record<string, unknown>;
  sourceFile?: string;
}

export class ThemeConfigLoader {
  async load(config: AntdThemeSourceConfig): Promise<ThemeConfigLoadResult> {
    if (isPlainObject(config.themeConfig)) {
      return {
        themeConfig: { ...config.themeConfig },
        sourceFile: config.filePath
      };
    }

    if (isPlainObject(config.designToken)) {
      return {
        themeConfig: {
          token: { ...config.designToken }
        },
        sourceFile: config.filePath
      };
    }

    if (!config.filePath) {
      throw new Error(
        'antdTheme source requires one of themeConfig, designToken, or filePath'
      );
    }

    return this.loadFromFile(config.filePath, config.exportName);
  }

  private async loadFromFile(
    filePath: string,
    exportName?: string
  ): Promise<ThemeConfigLoadResult> {
    const extension = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf-8');

    switch (extension) {
      case '.json':
        return {
          themeConfig: this.ensureThemeConfig(JSON.parse(content), filePath),
          sourceFile: filePath
        };

      case '.js':
      case '.cjs':
      case '.mjs':
      case '.ts':
        return {
          themeConfig: this.extractThemeConfigFromModule(
            filePath,
            content,
            exportName
          ),
          sourceFile: filePath
        };

      default:
        throw new Error(
          `Unsupported theme config file type: ${extension || 'unknown'}`
        );
    }
  }

  private extractThemeConfigFromModule(
    filePath: string,
    content: string,
    exportName?: string
  ): Record<string, unknown> {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.ES2022,
      true,
      this.getScriptKind(filePath)
    );

    const exportsMap = new Map<string, ts.Expression>();

    for (const statement of sourceFile.statements) {
      if (ts.isExportAssignment(statement)) {
        exportsMap.set('default', statement.expression);
        continue;
      }

      if (
        ts.isVariableStatement(statement) &&
        hasExportModifier(statement.modifiers)
      ) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
            continue;
          }
          exportsMap.set(declaration.name.text, declaration.initializer);
        }
        continue;
      }

      if (!ts.isExpressionStatement(statement)) {
        continue;
      }

      const assignment = this.getAssignmentExpression(statement.expression);
      if (!assignment) {
        continue;
      }

      const exportKey = this.getCommonJsExportKey(assignment.left);
      if (exportKey) {
        exportsMap.set(exportKey, assignment.right);
      }
    }

    const preferredKeys = exportName
      ? [exportName]
      : ['default', 'themeConfig', 'module.exports', 'exports.themeConfig'];

    for (const key of preferredKeys) {
      const expression = exportsMap.get(key);
      if (!expression) {
        continue;
      }

      const extracted = extractLiteralValue(expression, sourceFile);
      return this.ensureThemeConfig(extracted, filePath, key);
    }

    throw new Error(
      exportName
        ? `Theme config export "${exportName}" was not found in ${filePath}`
        : `No supported theme config export found in ${filePath}. Supported forms: export default { ... }, export const themeConfig = { ... }, module.exports = { ... }, exports.themeConfig = { ... }`
    );
  }

  private ensureThemeConfig(
    value: unknown,
    filePath: string,
    exportName?: string
  ): Record<string, unknown> {
    if (!isPlainObject(value)) {
      const suffix = exportName ? ` from export "${exportName}"` : '';
      throw new Error(
        `Theme config${suffix} in ${filePath} must be a plain object`
      );
    }

    return value;
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case '.ts':
        return ts.ScriptKind.TS;
      case '.mjs':
        return ts.ScriptKind.JS;
      case '.cjs':
        return ts.ScriptKind.JS;
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
    const result: Record<string, unknown> = {};

    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        throw createUnsupportedExpressionError(
          'Spread syntax is not supported in theme config files',
          property,
          sourceFile
        );
      }

      if (!ts.isPropertyAssignment(property)) {
        throw createUnsupportedExpressionError(
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

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        throw createUnsupportedExpressionError(
          'Spread syntax is not supported in theme config arrays',
          element,
          sourceFile
        );
      }

      return extractLiteralValue(element, sourceFile);
    });
  }

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

  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    throw createUnsupportedExpressionError(
      'Function exports are not supported. Export a plain object instead',
      expression,
      sourceFile
    );
  }

  if (ts.isIdentifier(expression)) {
    throw createUnsupportedExpressionError(
      `Identifier "${expression.text}" is not supported. Theme config files must export plain objects without runtime references`,
      expression,
      sourceFile
    );
  }

  throw createUnsupportedExpressionError(
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
    'Computed property names are not supported in theme config files',
    propertyName,
    sourceFile
  );
}

function createUnsupportedExpressionError(
  message: string,
  node: ts.Node,
  sourceFile: ts.SourceFile
): Error {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );

  return new Error(
    `${message} (${path.basename(sourceFile.fileName)}:${line + 1}:${character + 1})`
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
