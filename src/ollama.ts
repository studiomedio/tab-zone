/**
 * Minimal Ollama client for fill-in-the-middle (FIM) code completion.
 *
 * Ollama's /api/generate does not perform FIM automatically — the prefix and
 * suffix must be wrapped in the special tokens the model was trained on. Those
 * tokens differ per model family, hence `FimTemplate`.
 */

export type FimTemplate = "qwen" | "codellama" | "starcoder" | "deepseek";

export interface CompletionRequest {
  endpoint: string;
  model: string;
  template: FimTemplate;
  prefix: string;
  suffix: string;
  maxTokens: number;
  temperature: number;
  signal: AbortSignal;
}

/**
 * Build the raw FIM prompt for a given model family.
 * The trailing FIM-middle token tells the model to emit the infill.
 */
function buildFimPrompt(template: FimTemplate, prefix: string, suffix: string): string {
  switch (template) {
    // Qwen2.5-Coder / StarCoder2 share the same PSM token scheme.
    case "qwen":
    case "starcoder":
      return `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
    case "codellama":
      return `<PRE> ${prefix} <SUF>${suffix} <MID>`;
    case "deepseek":
      return `<｜fim▁begin｜>${prefix}<｜fim▁hole｜>${suffix}<｜fim▁end｜>`;
    default:
      return `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
  }
}

/**
 * Stop tokens that indicate the model has finished the infill. Passed to
 * Ollama so generation halts early instead of running to maxTokens.
 */
function stopTokens(template: FimTemplate): string[] {
  switch (template) {
    case "qwen":
    case "starcoder":
      return ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>", "<|file_sep|>"];
    case "codellama":
      return ["<PRE>", "<SUF>", "<MID>", "<EOT>"];
    case "deepseek":
      return ["<｜fim▁begin｜>", "<｜fim▁hole｜>", "<｜fim▁end｜>", "<|EOT|>"];
    default:
      return ["<|endoftext|>"];
  }
}

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

/**
 * Request a single (non-streamed) completion from Ollama.
 * Returns the raw infill text, or "" if nothing usable was produced.
 * Throws on network/abort so the caller can distinguish cancellation.
 */
export async function fetchCompletion(req: CompletionRequest): Promise<string> {
  const prompt = buildFimPrompt(req.template, req.prefix, req.suffix);

  const res = await fetch(`${req.endpoint.replace(/\/+$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      prompt,
      stream: false,
      raw: true, // we supply the exact FIM prompt; skip Ollama's chat templating
      options: {
        temperature: req.temperature,
        num_predict: req.maxTokens,
        stop: stopTokens(req.template),
      },
    }),
    signal: req.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama returned ${res.status}: ${body || res.statusText}`);
  }

  const data = (await res.json()) as OllamaGenerateResponse;
  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }
  return data.response ?? "";
}
