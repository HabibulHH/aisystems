# Step 4: Chains — `.pipe()` diye step jora

## 1. Ek line e concept

> **Chain = kichu step pashapashi jora, jekhane ek step er output porer step er input hoy.**

Factory conveyor belt er moto: kacha mal dhoke → protita machine kichu kaj kore → shesh e finished product ber hoy.

```
input → [step 1] → [step 2] → [step 3] → final output
```

---

## 2. Sobcheye common chain: prompt → model → parser

```
{ language: "Bangla", text: "Hello" }      ← apnar input (object)
        │
        ▼
   ┌──────────┐
   │  prompt  │   {variable} boshiye message list banay
   └──────────┘
        │  [SystemMessage, HumanMessage]
        ▼
   ┌──────────┐
   │  model   │   AI ke pathay (← ekhane API call + cost hoy)
   └──────────┘
        │  AIMessage { content, usage_metadata, ... }
        ▼
   ┌──────────┐
   │  parser  │   AIMessage theke dorkari output ber kore
   └──────────┘
        │
        ▼
   "হ্যালো"                                 ← final output (string)
```

| Step | Input | Output | Kaj |
|---|---|---|---|
| `prompt` | `{ language, text }` | `Message[]` | Template e value boshay |
| `model` | `Message[]` | `AIMessage` | AI theke answer ane |
| `parser` | `AIMessage` | `string` / object | Answer ke clean/process kore |

**Rule:** ek step er **output type** = porer step er **input type**. Na mille chain bhenge jay.

---

## 3. `.pipe()` chara vs `.pipe()` diye

### `.pipe()` chara (hate kore protita step)
```ts
const messages  = await prompt.invoke({ language: "Bangla", text: "Hello" });
const aiMessage = await model.invoke(messages);
const result    = await parser.invoke(aiMessage);
```

### `.pipe()` diye
```ts
import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatAnthropic({ model: "claude-sonnet-5" });

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a translator. Translate to {language}. Reply with only the translation."],
  ["human", "{text}"],
]);

const parser = new StringOutputParser();

const translateChain = prompt.pipe(model).pipe(parser);

const result = await translateChain.invoke({ language: "Bangla", text: "Hello" });
console.log(result); // "হ্যালো"  ← direct string, .content lagbe na
```

Duitar result eki. Kintu chain ekbar banale **reusable function** er moto bar bar use kora jay.

---

## 4. "Runnable": keno sob kichu `.pipe()` korte pare

LangChain e prompt, model, parser — sobai **Runnable**. Runnable mane:

| Method | Kaj |
|---|---|
| `.invoke(input)` | Ekta input → ekta output |
| `.stream(input)` | Output tukro tukro ase (puro chain er shesh step theke) |
| `.batch([in1, in2])` | Onekgulo input parallel e chalay |
| `.pipe(next)` | Porer step jore notun Runnable banay |

Ar chain nije-o ekta Runnable. Tai **chain er sathe chain jora jay**.

```ts
// stream: puro chain e kaj kore
for await (const piece of await translateChain.stream({ language: "Bangla", text: "Good morning" })) {
  process.stdout.write(piece);
}

// batch: 3 ta translation ekshathe (3 ta API call → 3 gun cost)
const results = await translateChain.batch([
  { language: "Bangla", text: "Hello" },
  { language: "Hindi", text: "Hello" },
  { language: "Japanese", text: "Hello" },
]);
```

---

## 5. Parser er dhoron: output ke "process" kora

| Parser / method | Output | Kokhon |
|---|---|---|
| `StringOutputParser` | `string` | Shudhu text dorkar |
| `JsonOutputParser` | JSON object | AI ke JSON dite bolle |
| `model.withStructuredOutput(zodSchema)` | Typed object ✅ | Fixed shape er data dorkar (Step 5) |
| Nijer function `(msg) => ...` | Je kono kichu | Custom processing |

```ts
// Nijer function o step hishebe .pipe() e deya jay
const chain = prompt
  .pipe(model)
  .pipe((msg) => msg.text)                 // AIMessage → string
  .pipe((text) => text.trim().toUpperCase()); // string → processed string
```

---

## 6. ⭐ Multi-AI-call chain: ek AI er output → arek AI er input

Ekhanei chain er asol power. Udaharon: **English article → Bangla translation → 1 line summary**

```
{ text: "<long English article>" }
        │
        ▼
 ┌────────────────────┐
 │  translateChain    │  ← AI call #1
 └────────────────────┘
        │  "<Bangla article>"  (string)
        ▼
 ┌────────────────────┐
 │ (t) => ({ text: t })│  ← string ke object banano (shape milano)
 └────────────────────┘
        │  { text: "<Bangla article>" }
        ▼
 ┌────────────────────┐
 │  summarizeChain    │  ← AI call #2
 └────────────────────┘
        │
        ▼
 "<1 line Bangla summary>"
```

```ts
const translatePrompt = ChatPromptTemplate.fromTemplate(
  "Translate this to Bangla. Reply with only the translation:\n\n{text}"
);
const summarizePrompt = ChatPromptTemplate.fromTemplate(
  "Summarize this in one short Bangla sentence:\n\n{text}"
);

const translateChain = translatePrompt.pipe(model).pipe(new StringOutputParser());
const summarizeChain = summarizePrompt.pipe(model).pipe(new StringOutputParser());

const fullChain = translateChain
  .pipe((translated: string) => ({ text: translated })) // shape milano!
  .pipe(summarizeChain);

const summary = await fullChain.invoke({ text: "LangChain is a framework for..." });
```

### ⚠️ Sobcheye common bhul
`translateChain` er output **string**, kintu `summarizeChain` er prompt chay **`{ text }` object**.
Majhkhane `(t) => ({ text: t })` na dile error:
```
Missing value for input variable `text`
```

---

## 7. Parallel chain: ek input → onek AI ekshathe

Ekta object `{ }` diye pipe korle protita key **parallel e** chole:

```ts
import { RunnableParallel } from "@langchain/core/runnables";

const analyze = RunnableParallel.from({
  summary:   summarizeChain,   // AI call #1  ┐
  translate: translateChain,   // AI call #2  ├─ ekshathe chole (fast)
  keywords:  keywordChain,     // AI call #3  ┘
});

const result = await analyze.invoke({ text: "..." });
// { summary: "...", translate: "...", keywords: "..." }
```

```
               ┌─► summarizeChain ─┐
{ text } ──────┼─► translateChain ─┼──► { summary, translate, keywords }
               └─► keywordChain  ──┘
```

---

## 8. `RunnablePassthrough`: original input harano theke bachano

Chain e porer step e ager value harie jay. Original input pore-o lagle:

```ts
import { RunnablePassthrough } from "@langchain/core/runnables";

const chain = RunnableParallel.from({
  original:   new RunnablePassthrough(),  // input jemon chilo temni rakhe
  translated: translateChain,
});
// { original: { text: "Hello" }, translated: "হ্যালো" }
```

---

## 9. 💰 Cost: chain e ki hoy

| Chain | API call | Cost |
|---|---|---|
| `prompt.pipe(model).pipe(parser)` | 1 | 1× |
| translate → summarize (section 6) | 2 | 2× |
| Parallel 3 ta (section 7) | 3 | 3× |
| `.batch([...])` 10 ta input | 10 | 10× |

⚠️ **Parser `usage_metadata` (token count) fele dey.** Tai chain er shesh e `CostTracker.add()` call kora jay na.
Solution: **callbacks** (Step 6). Callback protiti model call er bhetor theke token dhore, chain jotoi lomba hok.

---

## 10. Debugging: majher step e ki hocche dekha

```ts
const debug = (label: string) => (x: unknown) => {
  console.log(`[${label}]`, x);
  return x; // value pass kore dite hobe!
};

const chain = translateChain
  .pipe(debug("after translate"))
  .pipe((t: string) => ({ text: t }))
  .pipe(summarizeChain);
```

---

## 11. Summary

- `.pipe()` = ek step er output → porer step er input
- Prompt, model, parser, function, chain: sob **Runnable**, sob jora jay
- Output type ↔ input type milte hobe. Na mille majhkhane ekta `(x) => ({ ... })` step dao
- **Sequence** (`.pipe`) = ektar por ekta. **Parallel** (`{ }` / `RunnableParallel`) = ekshathe
- Protiti `model` step = ekta API call = cost
- Parser token count harie fele. Tai cost tracking er jonno callbacks lagbe

---

## 12. ✏️ Practice

1. Translator chain banao (section 3) ar `.batch()` diye 3 ta bhashay translate koro.
2. Section 6 er moto 2-step chain banao: **English → Bangla → summary**.
3. Majhkhane `debug()` step boshao, intermediate output dekho.
4. Section 7 er moto parallel chain banao: ek article theke `summary`, `title`, `keywords`.
5. Bonus: 4 number e koto gulo API call holo? Cost koto hobe?
