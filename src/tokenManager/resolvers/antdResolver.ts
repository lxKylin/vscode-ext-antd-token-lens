import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { createRequire } from 'node:module';
import { AntdThemeSourceConfig } from '../sourceTypes';

export interface ResolvedAntdThemeApi {
  packagePath: string;
  version?: string;
  getDesignToken: (
    themeConfig?: Record<string, unknown>
  ) => Record<string, unknown>;
  algorithms: {
    defaultAlgorithm?: unknown;
    darkAlgorithm?: unknown;
    compactAlgorithm?: unknown;
  };
}

export class AntdResolver {
  async resolve(config: AntdThemeSourceConfig): Promise<ResolvedAntdThemeApi> {
    const startDirs = this.getResolutionStartDirs(config);
    const failures: string[] = [];

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
          throw new Error(
            'Resolved antd package does not expose theme.getDesignToken()'
          );
        }

        return {
          packagePath: packageDir,
          version: packageJson.version,
          getDesignToken: (themeConfig?: Record<string, unknown>) => {
            const result = themeApi.getDesignToken?.(themeConfig);
            if (!isPlainObject(result)) {
              throw new Error(
                'theme.getDesignToken() must return a plain object'
              );
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
        failures.push(
          `${startDir}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(
      `Failed to resolve project local antd. Attempted from: ${startDirs.join(', ')}. Reasons: ${failures.join(' | ')}`
    );
  }

  resolveAlgorithms(
    themeConfig: Record<string, unknown>,
    algorithms: ResolvedAntdThemeApi['algorithms']
  ): Record<string, unknown> {
    if (!('algorithm' in themeConfig)) {
      return themeConfig;
    }

    return {
      ...themeConfig,
      algorithm: this.resolveAlgorithmValue(themeConfig.algorithm, algorithms)
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
        throw new Error(
          `Unsupported algorithm alias "${name}". Supported values are: default, dark, compact`
        );
    }

    throw new Error(
      `Algorithm alias "${name}" is not available in the resolved antd package`
    );
  }

  private getResolutionStartDirs(config: AntdThemeSourceConfig): string[] {
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

    return Array.from(new Set(startDirs.map((dir) => path.resolve(dir))));
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
