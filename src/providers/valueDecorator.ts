import * as vscode from 'vscode';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';
import { TokenMatch } from '@/tokenManager/tokenScanner';
import { Config } from '@/utils/config';
import {
  TokenValueFormatter,
  TokenValueFormatterOptions
} from '@/utils/tokenValueFormatter';
import { TokenDecorator } from './tokenDecorator';

export class ValueDecorator implements TokenDecorator {
  readonly configurationSection = 'antdToken.valueDecorator';

  private readonly decorationTypes = new Map<
    string,
    vscode.TextEditorDecorationType
  >();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly tokenRegistry: TokenRegistry,
    private readonly themeManager: ThemeManager
  ) {
    this.initialize();
  }

  decorate(editor: vscode.TextEditor, matches: TokenMatch[]): void {
    this.clear(editor);

    const valueGroups = new Map<string, vscode.Range[]>();
    const options = this.getFormatterOptions();

    for (const match of matches) {
      const tokenInfo = this.tokenRegistry.get(
        match.tokenName,
        this.themeManager.getCurrentTheme()
      );

      if (!tokenInfo || tokenInfo.isColor) {
        continue;
      }

      const formattedValue = TokenValueFormatter.format(tokenInfo, options);
      if (!formattedValue) {
        continue;
      }

      if (!valueGroups.has(formattedValue)) {
        valueGroups.set(formattedValue, []);
      }

      valueGroups.get(formattedValue)!.push(match.tokenRange);
    }

    for (const [displayText, ranges] of valueGroups) {
      const decorationType = this.getOrCreateDecorationType(displayText);
      editor.setDecorations(decorationType, ranges);
    }
  }

  clear(editor: vscode.TextEditor): void {
    for (const decorationType of this.decorationTypes.values()) {
      editor.setDecorations(decorationType, []);
    }
  }

  refresh(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
  }

  isEnabled(): boolean {
    return Config.getValueDecoratorEnabled();
  }

  dispose(): void {
    this.refresh();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private getOrCreateDecorationType(
    displayText: string
  ): vscode.TextEditorDecorationType {
    const position = Config.getValueDecoratorPosition();
    const cacheKey = `${position}:${displayText}`;

    if (!this.decorationTypes.has(cacheKey)) {
      this.decorationTypes.set(
        cacheKey,
        vscode.window.createTextEditorDecorationType({
          [position]: {
            contentText: displayText,
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
            margin: position === 'before' ? '0 1ch 0 0' : '0 0 0 1ch'
          },
          rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        })
      );
    }

    return this.decorationTypes.get(cacheKey)!;
  }

  private getFormatterOptions(): TokenValueFormatterOptions {
    return {
      enabledCategories: Config.getValueDecoratorCategories(),
      maxLength: Config.getValueDecoratorMaxLength(),
      mode: Config.getValueDecoratorMode()
    };
  }

  private initialize(): void {
    this.disposables.push(
      this.themeManager.onThemeChange(() => {
        this.refresh();
      }),
      Config.onConfigChange((event) => {
        if (event.affectsConfiguration(this.configurationSection)) {
          this.refresh();
        }
      })
    );
  }
}
