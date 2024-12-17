import * as vscode from 'vscode';
import { exec } from 'child_process';

export const outputChannel = vscode.window.createOutputChannel('CppInsight Analysis');

export interface CodeMetrics {
    file: string;
    functions: Array<{
        name: string;
        nloc: number;
        ccn: number;
        tokens: number;
        params: number;
        length: number;
        startLine: number;
        endLine: number;
        recommendation: string;
    }>;
}

export function analyzeCode(filePath: string): Promise<CodeMetrics> {
    return new Promise((resolve, reject) => {
        exec(`lizard -l cpp "${filePath}"`, (err, stdout, stderr) => {
            if (err) {
                logOutput(`⚠️ Lizard analysis completed with warnings.\n${stderr}`);
            } else {
                logOutput(`✅ Lizard analysis completed successfully.`);
            }

            try {
                const metrics = parseLizardOutput(stdout, filePath);
                logMetrics(metrics);

                checkGoogleCodeStyle(filePath)
                    .then(() => logOutput(`✅ Code style conforms to Google C++ guidelines.`))
                    .catch((styleError) => {
                        logOutput(`⚠️ clang-format issues detected:\n${styleError.message}`);
                        promptToFixStyle(filePath);
                    });

                checkNamingConventions(filePath);

                resolve(metrics);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

function parseLizardOutput(output: string, filePath: string): CodeMetrics {
    const functions = [];
    const lines = output.split('\n');

    for (const line of lines) {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\w:~]+)@(\d+)-(\d+)@/);
        if (match) {
            const [, nloc, ccn, tokens, params, length, name, startLine, endLine] = match;

            let recommendation = '';
            if (+nloc > 50) recommendation = ' Function too long. Consider splitting it.';
            else if (+ccn > 10) recommendation = ' High cyclomatic complexity. Simplify the logic.';

            functions.push({
                name,
                nloc: +nloc,
                ccn: +ccn,
                tokens: +tokens,
                params: +params,
                length: +length,
                startLine: +startLine,
                endLine: +endLine,
                recommendation,
            });
        }
    }

    return { file: filePath, functions };
}

function logMetrics(metrics: CodeMetrics): void {
    logOutput(`=== Lizard Code Analysis Report ===\nFile: ${metrics.file}\n`);

    const columnWidths = {
        name: 30,
        nloc: 6,
        ccn: 6,
        tokens: 8,
        params: 8,
        length: 8,
        startEnd: 10,
    };

    const header = [
        'Name'.padEnd(columnWidths.name),
        'NLOC'.padStart(columnWidths.nloc),
        'CCN'.padStart(columnWidths.ccn),
        'Tokens'.padStart(columnWidths.tokens),
        'Params'.padStart(columnWidths.params),
        'Length'.padStart(columnWidths.length),
        'Start-End'.padStart(columnWidths.startEnd),
    ].join('  ');

    const separator = '-'.repeat(header.length);

    logOutput(header);
    logOutput(separator);

    metrics.functions.forEach((func) => {
        const row = [
            func.name.padEnd(columnWidths.name),
            func.nloc.toString().padStart(columnWidths.nloc),
            func.ccn.toString().padStart(columnWidths.ccn),
            func.tokens.toString().padStart(columnWidths.tokens),
            func.params.toString().padStart(columnWidths.params),
            func.length.toString().padStart(columnWidths.length),
            `${func.startLine}-${func.endLine}`.padStart(columnWidths.startEnd),
        ].join('  ');

        logOutput(row);

        if (func.recommendation) {
            logOutput(`  ⚠️ ${func.recommendation}`);
        }
    });

    logOutput(`\n=== Analysis Completed ===`);
}

function checkGoogleCodeStyle(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`clang-format --style="{UseTab: ForIndentation, IndentWidth: 4, TabWidth: 4, ContinuationIndentWidth: 8}" --dry-run --Werror "${filePath}"`, (err, _, stderr) => {
            if (err) {
                reject(new Error(`clang-format issues:\n${stderr}`));
            } else {
                resolve();
            }
        });
    });
}

function checkNamingConventions(filePath: string): void {
    const functionPattern = /\b\w+::([a-zA-Z0-9_~]+)\b(?=\s*\()/g; 
    const snakeCase = /^[a-z]+(_[a-z0-9]+)*$/;
    const camelCase = /^[a-z]+([A-Z][a-z0-9]*)*$/;

    const ignoredFunctions = new Set([
        'main', 'operator', 'swap', 'begin', 'end', 'size', 'empty', 'at',
        'push_back', 'emplace_back', 'make_pair', 'to_string', 'out_of_range',
        'find', 'insert', 'sort'
    ]);

    const ignoredTypes = new Set([
        'int', 'float', 'double', 'char', 'bool', 'long', 'short', 'void',
        'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t',
        'uint64_t', 'int64_t', 'size_t', 'string', 'nullptr', 'std'
    ]);

    require('fs').readFile(filePath, 'utf8', (err: Error | null, data: string) => {
        if (err) {
            logOutput(`❌ Error reading file: ${err.message}`);
            return;
        }

        let issuesFound = false;
        const lines = data.split('\n');

        lines.forEach((line, index) => {
            let match;

            if (/^\s*#\s*(ifndef|define|endif)/.test(line)) {
                return; 
            }

            if (/".*?"/.test(line) || /'.*?'/.test(line)) {
                return;
            }

            while ((match = functionPattern.exec(line)) !== null) {
                const name = match[1];

                if (ignoredFunctions.has(name) || name.startsWith('~')) {
                    continue;
                }

                if (name.includes('_') && !camelCase.test(name)) {
                    logOutput(`⚠️ Line ${index + 1}: Function name "${name}" should follow camelCase.`);
                    issuesFound = true;
                }
            }

            line.match(/\b\w+\b/g)?.forEach((word) => {
                if (
                    ignoredTypes.has(word) || 
                    ignoredFunctions.has(word) || 
                    /".*?\b\w+\b.*?"/.test(line) ||
                    /'.*?\b\w+\b.*?'/.test(line)
                ) {
                    return;
                }

                if (word.includes('_') && !snakeCase.test(word)) {
                    logOutput(`⚠️ Line ${index + 1}: Variable "${word}" should follow snake_case.`);
                    issuesFound = true;
                }
            });
        });

        if (!issuesFound) {
            logOutput(`✅ Naming conventions passed.`);
        }
    });
}

function promptToFixStyle(filePath: string): void {
    vscode.window
        .showWarningMessage(`⚠️ Code style issues detected. Fix automatically?`, 'Yes, Fix', 'No')
        .then((choice) => {
            if (choice === 'Yes, Fix') {
                exec(`clang-format --style="{UseTab: ForIndentation, IndentWidth: 4, TabWidth: 4, ContinuationIndentWidth: 8}" -i "${filePath}"`, (err, _, stderr) => {
                    if (err) logOutput(`❌ Error fixing style: ${stderr || err.message}`);
                    else logOutput(`✅ Code style issues fixed successfully.`);
                });
            }
        });
}

function logOutput(message: string): void {
    outputChannel.appendLine(message);
    outputChannel.show(true);
}
