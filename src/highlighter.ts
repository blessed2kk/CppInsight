import * as vscode from 'vscode';
import { CodeMetrics } from './analyzer';

export function highlightIssues(editor: vscode.TextEditor, metrics: CodeMetrics) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.3)',
    });

    const ranges: vscode.DecorationOptions[] = [];

    metrics.functions.forEach(func => {
        if (func.ccn > 10 || func.nloc > 50) {
            const line = editor.document.lineAt(func.startLine - 1).range;
            ranges.push({ range: line });
        }
    });

    editor.setDecorations(decorationType, ranges);
}
