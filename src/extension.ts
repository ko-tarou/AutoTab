import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension is now active!');

	let previousLineCount = vscode.window.activeTextEditor
		? vscode.window.activeTextEditor.document.lineCount
		: 0;

	vscode.workspace.onDidChangeTextDocument((event) => {
		const editor = vscode.window.activeTextEditor;

		if (!editor || event.document !== editor.document) {
			console.log('No active editor or document mismatch.');
			return;
		}

		const currentLineCount = event.document.lineCount;
		const lineDifference = currentLineCount - previousLineCount;

		const changes = event.contentChanges;

		// 改行のみの変更を検出し、スキップ
		if (changes.length === 1 && changes[0].text.match(/^\r?\n$/)) {
			console.log('Detected a newline insertion. Skipping paste handling.');
			previousLineCount = currentLineCount; // 行数を更新
			return;
		}

		// ペースト判定: 2行以上増加
		if (lineDifference >= 2) {
			if (changes.length === 1) {
				const change = changes[0];

				// ペーストされた内容を取得
				const pastedText = change.text;

				// ペーストされた内容が空文字列または空行だけの場合は処理をスキップ
				if (!pastedText.trim()) {
					console.log('Paste operation skipped: No content to paste.');
					previousLineCount = currentLineCount; // 行数を更新
					return;
				}

				const pastedLines = pastedText.split(/\r?\n/);

				// 各行のタブ数またはスペース数をログに表示
				console.log('--- Indentation (Tabs + Spaces) per Line ---');
				pastedLines.forEach((line, index) => {
					const indentCount = countIndentAsTabs(line);
					console.log(`Line ${index + 1}: "${line}" -> Indent as Tabs: ${indentCount}`);
				});
				console.log('--------------------------------------------');

				const startLine = change.range.start.line;

				// 元データの1行目のインデントを取得
				const firstLineIndent = countIndentAsTabs(pastedLines[0]);
				console.log(`Original first line indent: ${firstLineIndent}`);

				// ペースト先の行の既存インデントを取得
				const pasteTargetLineText = event.document.lineAt(startLine).text;
				const pasteTargetIndent = countIndentAsTabs(pasteTargetLineText);
				console.log(`Paste target indent after insertion: ${pasteTargetIndent}`);

				// 元データの相対インデント差を調整
				const adjustedLines = pastedLines.map((line, index) => {
					if (index === 0) {
						const resultLine = '\t'.repeat(Math.max(0, pasteTargetIndent)) + line.trimStart();
						console.log(`Adjusted Line ${index + 1}: "${resultLine}" -> Tabs After Paste: ${countIndentAsTabs(resultLine)}`);
						return resultLine;
					}

					const currentIndent = countIndentAsTabs(line);
					const relativeIndent = currentIndent - firstLineIndent;

					const adjustedIndent = pasteTargetIndent + relativeIndent;

					const resultLine = '\t'.repeat(Math.max(0, adjustedIndent)) + line.trimStart();
					console.log(`Adjusted Line ${index + 1}: "${resultLine}" -> Tabs After Paste: ${countIndentAsTabs(resultLine)}`);
					return resultLine;
				});

				// ペースト範囲全体を置き換える
				const fullRange = new vscode.Range(
					new vscode.Position(startLine, 0),
					new vscode.Position(
						startLine + adjustedLines.length - 1,
						event.document.lineAt(startLine + adjustedLines.length - 1).text.length
					)
				);

				editor.edit(editBuilder => {
					editBuilder.replace(fullRange, adjustedLines.join('\n'));
				});

				console.log('Adjusted lines:');
				console.log(adjustedLines.join('\n'));
			}
		} else {
			console.log('Change is not a paste operation (line increase < 2).');
		}

		// 行数を更新
		previousLineCount = currentLineCount;
	});
}

export function deactivate() {
	console.log('Extension is now deactivated.');
}

// タブとスペースをタブ相当に変換してカウントする関数
function countIndentAsTabs(line: string): number {
	const tabSize = 4; // スペース4つを1タブとして換算
	let count = 0;

	for (const char of line) {
		if (char === '\t') {
			count += 1; // タブはそのまま1カウント
		} else if (char === ' ') {
			count += 1 / tabSize; // スペースは1/4タブとして換算
		} else {
			break; // インデント以外の文字が出たら終了
		}
	}

	return Math.floor(count); // 小数点以下切り捨て
}
