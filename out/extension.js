"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const analyzer_1 = require("./analyzer");
const highlighter_1 = require("./highlighter");
function activate(context) {
    vscode.window.showInformationMessage('CppInsight Plugin Activated');
    vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('cppinsight');
        const enableAnalysisOnSave = config.get('enableAnalysisOnSave', true);
        if (document.languageId === 'cpp' && enableAnalysisOnSave) {
            analyzer_1.outputChannel.clear();
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
exports.activate = activate;
async function runAnalysis(document) {
    const metrics = await (0, analyzer_1.analyzeCode)(document.uri.fsPath);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        (0, highlighter_1.highlightIssues)(editor, metrics);
    }
}
