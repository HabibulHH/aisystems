import type { UsageMetadata } from "@langchain/core/messages";

// Prices in USD per 1 million tokens
type Price = { input: number; output: number };

export const PRICES: Record<string, Record<string, Price>> = {
  anthropic: {
    "claude-sonnet-5": { input: 2, output: 10 },
    "claude-opus-5": { input: 5, output: 25 },
    "claude-haiku-4-5": { input: 1, output: 5 },
  },
  // Add other vendors here. Copy the prices from their pricing pages.
  // openai: { "model-name": { input: 0, output: 0 } },
  // google: { "model-name": { input: 0, output: 0 } },
  ollama: {
    "llama3.2": { input: 0, output: 0 }, // runs locally = free
  },
};

export function calculateCost(vendor: string, model: string, usage?: UsageMetadata) {
  const price = PRICES[vendor]?.[model];
  if (!price) throw new Error(`No price set for ${vendor} / ${model}`);
  if (!usage) throw new Error("Response has no usage data");

  const inputCost = (usage.input_tokens / 1_000_000) * price.input;
  const outputCost = (usage.output_tokens / 1_000_000) * price.output;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

// Adds up the cost of all calls, grouped by vendor and model
export class CostTracker {
  private totals: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUSD: number }> = {};

  add(vendor: string, model: string, usage?: UsageMetadata) {
    const { totalCost } = calculateCost(vendor, model, usage);
    const key = `${vendor}/${model}`;
    const row = (this.totals[key] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 });

    row.calls += 1;
    row.inputTokens += usage!.input_tokens;
    row.outputTokens += usage!.output_tokens;
    row.costUSD += totalCost;
    return totalCost;
  }

  report() {
    console.table(this.totals);
  }
}
export const USD_TO_BDT = 122; // update this when the rate changes

