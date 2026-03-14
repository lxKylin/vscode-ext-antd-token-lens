import * as vscode from 'vscode';
import { TokenMatch } from '@/tokenManager/tokenScanner';

export interface TokenDecorator extends vscode.Disposable {
  readonly configurationSection: string;

  decorate(editor: vscode.TextEditor, matches: TokenMatch[]): void;

  clear(editor: vscode.TextEditor): void;

  refresh(): void;

  isEnabled(): boolean;
}
