import * as assert from 'node:assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  initializeTokenRegistry,
  tokenRegistry,
  themeManager
} from '@/tokenManager';
import { TokenScanner } from '@/tokenManager/tokenScanner';
import { ColorDecorator } from '@/providers/colorDecorator';
import { ValueDecorator } from '@/providers/valueDecorator';
import { DocumentDecorationManager } from '@/providers/documentDecorationManager';

suite('Value Visualization Integration Test', () => {
  let scanner: TokenScanner;
  let manager: DocumentDecorationManager;

  suiteSetup(() => {
    const assetsPath = path.resolve(__dirname, '../../assets/css');
    initializeTokenRegistry(assetsPath);
  });

  setup(() => {
    scanner = new TokenScanner();
    manager = new DocumentDecorationManager(scanner, [
      new ColorDecorator(tokenRegistry, themeManager),
      new ValueDecorator(tokenRegistry, themeManager)
    ]);
  });

  teardown(() => {
    manager.dispose();
  });

  test('finds non-color tokens in CSS files', async function () {
    this.timeout(5000);

    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: [
        '.card {',
        '  padding: var(--ant-padding);',
        '  border-radius: var(--ant-border-radius);',
        '  transition-duration: var(--ant-motion-duration-mid);',
        '  opacity: var(--ant-opacity-image);',
        '}'
      ].join('\n')
    });

    await vscode.window.showTextDocument(doc);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const matches = scanner.scanDocument(doc);
    const valueTokens = matches.filter((match) => {
      const tokenInfo = tokenRegistry.get(
        match.tokenName,
        themeManager.getCurrentTheme()
      );

      return tokenInfo && !tokenInfo.isColor;
    });

    assert.ok(valueTokens.length >= 3, 'Should find non-color tokens');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
