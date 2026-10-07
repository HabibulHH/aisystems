import "dotenv/config"; // loads .env into process.env
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, type AIMessageChunk } from "@langchain/core/messages";
import { CostTracker, USD_TO_BDT } from "./utils/cost.js"; // ".js" even though the file is .ts

const VENDOR = "anthropic";
const MODEL = "claude-sonnet-5";

// 1. Create the model and a cost tracker
const model = new ChatAnthropic({ model: MODEL });
const tracker = new CostTracker();

// 2. Normal mode: wait for the full answer
console.log("--- Normal mode ---");
const response = await model.invoke([
  new SystemMessage("You are a helpful teacher. Answer in 2 short sentences."),
  new HumanMessage("What is LangChain?"),
]);
console.log(response.text);
console.log("Tokens:", response.usage_metadata);
const normalCost = tracker.add(VENDOR, MODEL, response.usage_metadata);
console.log(`Cost: $${normalCost.toFixed(6)}\n`);
console.log(`Cost: $${normalCost.toFixed(6)} (৳${(normalCost * USD_TO_BDT).toFixed(4)})`);


// // 3. Stream mode: print the answer piece by piece
// console.log("--- Stream mode ---");
// const stream = await model.stream("Tell me a 4-line poem about TypeScript");
// let full: AIMessageChunk | undefined; // joins all chunks, including token counts
// for await (const chunk of stream) {
//   process.stdout.write(chunk.text);
//   full = full ? full.concat(chunk) : chunk;
// }
// console.log("\nTokens:", full?.usage_metadata);
// const streamCost = tracker.add(VENDOR, MODEL, full?.usage_metadata);
// console.log(`Cost: $${streamCost.toFixed(6)}\n`);

// 4. Total per vendor/model
tracker.report();
