import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { createRequire } from 'node:module';
import { AntdThemeSourceConfig } from '../sourceTypes';
import { SourceErrorCode, TokenSourceError } from '../sourceDiagnostics';

export interface ResolvedAntdThemeApi {
  packagePath: string;
  version?: string;
  resolvedFrom: string;
  attemptedStartDirs: string[];
  allowWorkspaceFallback: boolean;
  getDesignToken: (
    themeConfig?: Record<string, unknown>
  ) => Record<string, unknown>;
  algorithms: {
    defaultAlgorithm?: unknown;
    darkAlgorithm?: unknown;
    compactAlgorithm?: unknown;
  };
}

export interface ResolvedAlgorithmResult {
  themeConfig: Record<string, unknown>;
  summary: string[];
}

export class AntdResolver {
  async resolve(config: AntdThemeSourceConfig): Promise<ResolvedAntdThemeApi> {
    const { startDirs, allowWorkspaceFallback } =
      this.getResolutionStartDirs(config);
    const failures: string[] = [];
    let packageNotFound = false;

    for (const startDir of startDirs) {
      try {
        const requireFromStart = createRequire(
          path.join(startDir, '__antd_resolver__.cjs')
        );
        const packageJsonPath = requireFromStart.resolve('antd/package.json');
        const packageDir = path.dirname(packageJsonPath);
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, 'utf-8')
        );
        const antdModule = requireFromStart('antd') as {
          theme?: {
            getDesignToken?: (themeConfig?: Record<string, unknown>) => unknown;
            defaultAlgorithm?: unknown;
            darkAlgorithm?: unknown;
            compactAlgorithm?: unknown;
          };
          default?: {
            theme?: {
              getDesignToken?: (
                themeConfig?: Record<string, unknown>
              ) => unknown;
              defaultAlgorithm?: unknown;
              darkAlgorithm?: unknown;
              compactAlgorithm?: unknown;
            };
          };
        };

        const themeApi = antdModule.theme ?? antdModule.default?.theme;
        if (!themeApi?.getDesignToken) {
          throw new TokenSourceError({
            code: SourceErrorCode.ANTD_GET_DESIGN_TOKEN_UNAVAILABLE,
            message: '解析到的 antd 包未暴露 theme.getDesignToken()'
          });
        }

        return {
          packagePath: packageDir,
          version: packageJson.version,
          resolvedFrom: startDir,
          attemptedStartDirs: startDirs,
          allowWorkspaceFallback,
          getDesignToken: (themeConfig?: Record<string, unknown>) => {
            const result = themeApi.getDesignToken?.(themeConfig);
            if (!isPlainObject(result)) {
              throw new TokenSourceError({
                code: SourceErrorCode.ANTD_GET_DESIGN_TOKEN_INVALID_RETURN,
                message: 'theme.getDesignToken() 返回值不是纯对象'
              });
            }
            return result;
          },
          algorithms: {
            defaultAlgorithm: themeApi.defaultAlgorithm,
            darkAlgorithm: themeApi.darkAlgorithm,
            compactAlgorithm: themeApi.compactAlgorithm
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Cannot find module 'antd/package.json'")) {
          packageNotFound = true;
        }
        failures.push(`${startDir}: ${message}`);
      }
    }

    throw new TokenSourceError({
      code: packageNotFound
        ? SourceErrorCode.ANTD_PACKAGE_NOT_FOUND
        : SourceErrorCode.ANTD_RESOLVE_FAILED,
      message:
        '无法解析项目本地 antd，请检查依赖安装位置与 resolveFromWorkspace 配置',
      details: `尝试起点: ${startDirs.join(', ')}; 允许工作区回退: ${allowWorkspaceFallback ? '是' : '否'}; 失败原因: ${failures.join(' | ')}`,
      metadata: {
        attemptedStartDirs: startDirs,
        allowWorkspaceFallback,
        failures
      }
    });
  }

  resolveAlgorithms(
    themeConfig: Record<string, unknown>,
    algorithms: ResolvedAntdThemeApi['algorithms']
  ): Record<string, unknown> {
    return this.resolveAlgorithmsDetailed(themeConfig, algorithms).themeConfig;
  }

  resolveAlgorithmsDetailed(
    themeConfig: Record<string, unknown>,
    algorithms: ResolvedAntdThemeApi['algorithms']
  ): ResolvedAlgorithmResult {
    if (!('algorithm' in themeConfig)) {
      return {
        themeConfig,
        summary: []
      };
    }

    return {
      themeConfig: {
        ...themeConfig,
        algorithm: this.resolveAlgorithmValue(themeConfig.algorithm, algorithms)
      },
      summary: this.summarizeAlgorithmValue(themeConfig.algorithm)
    };
  }

  private resolveAlgorithmValue(
    algorithmValue: unknown,
    algorithms: ResolvedAntdThemeApi['algorithms']
  ): unknown {
    if (typeof algorithmValue === 'string') {
      return this.resolveAlgorithmName(algorithmValue, algorithms);
    }

    if (
      Array.isArray(algorithmValue) &&
      algorithmValue.every((item) => typeof item === 'string')
    ) {
      return algorithmValue.map((item) =>
        this.resolveAlgorithmName(item, algorithms)
      );
    }

    return algorithmValue;
  }

  private resolveAlgorithmName(
    name: string,
    algorithms: ResolvedAntdThemeApi['algorithms']
  ): unknown {
    switch (name) {
      case 'default':
        if (algorithms.defaultAlgorithm !== undefined) {
          return algorithms.defaultAlgorithm;
        }
        break;
      case 'dark':
        if (algorithms.darkAlgorithm !== undefined) {
          return algorithms.darkAlgorithm;
        }
        break;
      case 'compact':
        if (algorithms.compactAlgorithm !== undefined) {
          return algorithms.compactAlgorithm;
        }
        break;
      default:
        throw new TokenSourceError({
          code: SourceErrorCode.ANTD_ALGORITHM_UNKNOWN,
          message: `无法识别算法标记 ${name}，仅支持 default、dark、compact`,
          metadata: {
            algorithm: name
          }
        });
    }

    throw new TokenSourceError({
      code: SourceErrorCode.ANTD_ALGORITHM_UNAVAILABLE,
      message: `当前解析到的 antd 包不支持算法标记 ${name}`,
      metadata: {
        algorithm: name
      }
    });
  }

  private summarizeAlgorithmValue(algorithmValue: unknown): string[] {
    if (typeof algorithmValue === 'string') {
      return [algorithmValue];
    }

    if (
      Array.isArray(algorithmValue) &&
      algorithmValue.every((item) => typeof item === 'string')
    ) {
      return [...algorithmValue];
    }

    return [];
  }

  private getResolutionStartDirs(config: AntdThemeSourceConfig): {
    startDirs: string[];
    allowWorkspaceFallback: boolean;
  } {
    const startDirs: string[] = [];

    if (config.filePath) {
      startDirs.push(path.dirname(config.filePath));
    }

    if (config.resolveFromWorkspace !== false) {
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        startDirs.push(folder.uri.fsPath);
      }
    }

    if (startDirs.length === 0) {
      startDirs.push(process.cwd());
    }

    return {
      startDirs: Array.from(new Set(startDirs.map((dir) => path.resolve(dir)))),
      allowWorkspaceFallback: config.resolveFromWorkspace !== false
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
