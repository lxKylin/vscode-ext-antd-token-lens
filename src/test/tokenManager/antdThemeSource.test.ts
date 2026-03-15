import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { AntdThemeTokenSource } from '@/tokenManager/sources/antdThemeSource';
import {
  ResolvedAntdThemeApi,
  AntdResolver
} from '@/tokenManager/resolvers/antdResolver';
import {
  ThemeConfigLoader,
  ThemeConfigLoadResult
} from '@/tokenManager/resolvers/themeConfigLoader';
import { SourceType } from '@/tokenManager/sourceTypes';

suite('AntdThemeTokenSource Test Suite', () => {
  test('loads tokens successfully', async () => {
    class StubThemeConfigLoader extends ThemeConfigLoader {
      override async load(): Promise<ThemeConfigLoadResult> {
        return {
          themeConfig: {
            token: {
              colorPrimary: '#13c2c2'
            }
          }
        };
      }
    }

    class StubAntdResolver extends AntdResolver {
      override async resolve(): Promise<ResolvedAntdThemeApi> {
        return {
          packagePath: '/tmp/node_modules/antd',
          version: '5.0.0-test',
          getDesignToken: (themeConfig) => ({
            colorPrimary: String(
              (themeConfig?.token as Record<string, unknown>)?.colorPrimary
            ),
            borderRadius: 6
          }),
          algorithms: {}
        };
      }
    }

    const source = new AntdThemeTokenSource(
      {
        type: SourceType.ANTD_THEME,
        enabled: true,
        priority: 5,
        baseTheme: 'light',
        designToken: {
          colorPrimary: '#13c2c2'
        }
      },
      {
        themeConfigLoader: new StubThemeConfigLoader(),
        antdResolver: new StubAntdResolver()
      }
    );

    const tokens = await source.load();

    assert.strictEqual(tokens.length, 2);
    assert.strictEqual(tokens[0].theme, 'light');
    assert.strictEqual(tokens[0].sourceType, SourceType.ANTD_THEME);
    assert.ok(tokens.some((token) => token.name === '--ant-color-primary'));
  });

  test('validate fails when no input is provided', async () => {
    const source = new AntdThemeTokenSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 5
    });

    assert.strictEqual(await source.validate(), false);
  });

  test('emits change event when watched file changes', () => {
    class FakeWatcher implements vscode.FileSystemWatcher {
      readonly ignoreCreateEvents = false;
      readonly ignoreChangeEvents = false;
      readonly ignoreDeleteEvents = false;
      private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
      private readonly createEmitter = new vscode.EventEmitter<vscode.Uri>();
      private readonly deleteEmitter = new vscode.EventEmitter<vscode.Uri>();
      readonly onDidChange = this.changeEmitter.event;
      readonly onDidCreate = this.createEmitter.event;
      readonly onDidDelete = this.deleteEmitter.event;

      fireChange(uri: vscode.Uri): void {
        this.changeEmitter.fire(uri);
      }

      dispose(): void {
        this.changeEmitter.dispose();
        this.createEmitter.dispose();
        this.deleteEmitter.dispose();
      }
    }

    const fakeWatcher = new FakeWatcher();
    const source = new AntdThemeTokenSource(
      {
        type: SourceType.ANTD_THEME,
        enabled: true,
        priority: 5,
        filePath: '/tmp/theme.ts',
        watch: true
      },
      {
        createFileSystemWatcher: () => fakeWatcher
      }
    );

    let callCount = 0;
    const disposable = source.onDidChange(() => {
      callCount += 1;
    });

    fakeWatcher.fireChange(vscode.Uri.file('/tmp/theme.ts'));

    assert.strictEqual(callCount, 1);
    disposable.dispose();
    source.dispose();
  });
});
