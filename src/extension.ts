import * as vscode from "vscode";
import { fetchCompletion, FimTemplate } from "./ollama";

let enabled = true;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  enabled = getConfig<boolean>("enabled", true);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "tabZone.toggle";
  context.subscriptions.push(statusBar);
  updateStatusBar();

  const provider = new OllamaCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tabZone.toggle", () => {
      enabled = !enabled;
      updateStatusBar();
      vscode.window.setStatusBarMessage(
        `tab.zone ${enabled ? "enabled" : "disabled"}`,
        2000
      );
    })
  );
}

export function deactivate() {}

function getConfig<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration("tabZone").get<T>(key, fallback);
}

function updateStatusBar() {
  statusBar.text = enabled ? "$(sparkle) tab.zone" : "$(circle-slash) tab.zone";
  statusBar.tooltip = `tab.zone inline completions are ${enabled ? "on" : "off"} — click to toggle`;
  statusBar.show();
}

class OllamaCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    if (!enabled || !getConfig<boolean>("enabled", true)) {
      return undefined;
    }

    // Debounce: wait, then bail if the user kept typing (token cancels).
    const debounceMs = getConfig<number>("debounceMs", 250);
    const settled = await sleep(debounceMs, token);
    if (!settled || token.isCancellationRequested) {
      return undefined;
    }

    const { prefix, suffix } = extractContext(document, position);
    if (prefix.trim().length === 0) {
      return undefined;
    }

    const controller = new AbortController();
    const cancelSub = token.onCancellationRequested(() => controller.abort());

    try {
      const raw = await fetchCompletion({
        endpoint: getConfig<string>("endpoint", "http://localhost:11434"),
        model: getConfig<string>("model", "qwen2.5-coder:7b"),
        template: getConfig<FimTemplate>("fimTemplate", "qwen"),
        prefix,
        suffix,
        maxTokens: getConfig<number>("maxTokens", 256),
        temperature: getConfig<number>("temperature", 0.1),
        signal: controller.signal,
      });

      const completion = trimCompletion(raw);
      if (!completion || token.isCancellationRequested) {
        return undefined;
      }

      return [
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position)
        ),
      ];
    } catch (err) {
      // Aborts are expected when the user keeps typing — stay quiet.
      if (controller.signal.aborted || token.isCancellationRequested) {
        return undefined;
      }
      console.error("[tab.zone] completion failed:", err);
      return undefined;
    } finally {
      cancelSub.dispose();
    }
  }
}

/** Gather bounded prefix/suffix around the cursor. */
function extractContext(
  document: vscode.TextDocument,
  position: vscode.Position
): { prefix: string; suffix: string } {
  const maxPrefix = getConfig<number>("maxPrefixChars", 3000);
  const maxSuffix = getConfig<number>("maxSuffixChars", 1000);

  const offset = document.offsetAt(position);
  const full = document.getText();

  const prefix = full.slice(Math.max(0, offset - maxPrefix), offset);
  const suffix = full.slice(offset, offset + maxSuffix);
  return { prefix, suffix };
}

/**
 * Drop a leading newline the model sometimes emits, and cut trailing
 * whitespace that would otherwise show as a dangling ghost line.
 */
function trimCompletion(text: string): string {
  return text.replace(/^\n/, "").replace(/\s+$/, "");
}

/** Resolve to true if the delay elapsed, false if cancelled first. */
function sleep(ms: number, token: vscode.CancellationToken): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.dispose();
      resolve(true);
    }, ms);
    const sub = token.onCancellationRequested(() => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}
