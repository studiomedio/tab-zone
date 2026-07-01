# tab.zone

Copilot-style **tab autocomplete for VS Code, powered by a local [Ollama](https://ollama.com) server**. Your code never leaves your machine.

Inline (ghost-text) completions appear as you type; press <kbd>Tab</kbd> to accept.

## Requirements

- [Ollama](https://ollama.com) running locally (default `http://localhost:11434`)
- A fill-in-the-middle (FIM) capable code model, e.g.:

  ```sh
  ollama pull qwen2.5-coder:7b
  ```

## Install

From the VS Code Marketplace: **[tab.zone](https://marketplace.visualstudio.com/items?itemName=studiomedio.tab-zone)**, or:

```sh
ext install studiomedio.tab-zone
```

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `tabZone.enabled` | `true` | Enable inline (ghost text) completions. |
| `tabZone.endpoint` | `http://localhost:11434` | Base URL of the local Ollama server. |
| `tabZone.model` | `qwen2.5-coder:7b` | Ollama FIM-capable code model to use. |
| `tabZone.fimTemplate` | `qwen` | FIM prompt template matching the model family (`qwen`, `codellama`, `starcoder`, `deepseek`). |
| `tabZone.debounceMs` | `250` | Delay after the last keystroke before requesting a completion. |
| `tabZone.maxPrefixChars` | `3000` | Max characters of context taken from before the cursor. |
| `tabZone.maxSuffixChars` | `1000` | Max characters of context taken from after the cursor. |
| `tabZone.maxTokens` | `256` | Max tokens generated per completion. |
| `tabZone.temperature` | `0.1` | Sampling temperature. Lower is more deterministic. |

Run **tab.zone: Toggle inline completions** from the Command Palette to turn suggestions on/off.

## Development

```sh
npm install
npm run watch        # rebuild on change
```

Press <kbd>F5</kbd> in VS Code to launch the Extension Development Host.

```sh
npm run typecheck    # tsc --noEmit
npm run package      # minified production build
```

## License

[MIT](./LICENSE) © Studio Medio
