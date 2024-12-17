import * as vscode from 'vscode';
import { analyzeCode, outputChannel } from './analyzer';
import { highlightIssues } from './highlighter';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('CppInsight Plugin Activated');
    vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('cppinsight');
        const enableAnalysisOnSave = config.get<boolean>('enableAnalysisOnSave', true);

        if (document.languageId === 'cpp' && enableAnalysisOnSave) {
            outputChannel.clear();
            vscode.window.showInformationMessage(`Analyzing ${document.fileName}...`);
            runAnalysis(document);
        }
    });

    const disposable = vscode.commands.registerCommand('cppinsight.analyze', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            runAnalysis(editor.document);
        }
    });

    context.subscriptions.push(disposable);
}

async function runAnalysis(document: vscode.TextDocument) {
    const metrics = await analyzeCode(document.uri.fsPath);
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        highlightIssues(editor, metrics);
    }
}
