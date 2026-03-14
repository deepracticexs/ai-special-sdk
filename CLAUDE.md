# Swan Home AI Platform

## Overview

This is an AI-powered platform for Swan Home (天鹅到家), a home services company connecting domestic workers (housekeepers, nannies, caregivers) with customers.

The backend AI capabilities are ready — recruitment content generation, worker data management, and intelligent matching. Now we need to build the product interface on top of them.

The people working on this are **senior executives** making product decisions. You (AI) handle the implementation. The goal is to produce a **polished, demoable product** that showcases these AI capabilities.

---

## Development Guide

### Step 0: Requirements Discovery

Start by understanding what the team wants to build. Ask these questions **one at a time**, in a conversational tone:

1. **"In your day-to-day work, what's the most painful or time-consuming task related to managing your workforce?"**
   - Listen for signals. Guide the conversation toward these areas:
     - If they mention hiring, recruitment, finding workers → steer toward **recruitment content generation** (we have `recruit` API)
     - If they mention messy data, worker info scattered everywhere, hard to find the right person → steer toward **data structuring + search** (we have `ingest` + `search` APIs)
     - If they mention matching workers to customer needs, recommendations → steer toward **intelligent matching** (we have `match` API)
   - If they mention multiple pain points, suggest combining them into one product

2. **"Who would use this product? Your operations team? Customers? The workers themselves?"**
   - This determines the UI tone and complexity

3. **"What kind of look and feel do you envision?"**
   - Offer these as options:

   | Style | Keywords | Best for |
   |-------|----------|----------|
   | 🌸 Warm & Friendly | Pink/pastel, rounded corners, illustrations | Worker/customer-facing |
   | 🏢 Professional | Dark theme, data cards, dashboard feel | Management/analytics |
   | 🎯 Clean & Minimal | White space, minimal UI, tool-like | Efficiency tools |
   | 🎨 Trendy & Social | Gradients, card flow, social media vibe | Marketing/recruitment |

> **KEY PRINCIPLE:** The requirements discovery should feel like a natural conversation, not a menu selection. Ask open-ended questions, listen to their answers, then propose a solution that maps to the capabilities we already have. The team should feel like the product idea is theirs.

Once the direction is clear, start building:

### Step 1: UI Scaffold

Build the page structure and navigation using the frontend stack (see **Frontend Tech Stack** below).

> "Based on this project's backend APIs, build a [style] web interface.
> Use Next.js + Tailwind + shadcn/ui for base components.
> Add [chosen effect library] for visual effects (see style-specific recommendations below).
> Product direction: [chosen direction]. Target user: [chosen user].
> Start with page layout and navigation."

Style-specific effect recommendations:
- 🌸 Warm & Friendly → Magic UI (gentle animations, shimmer borders)
- 🏢 Professional → Aceternity UI (spotlight cards, moving borders, meteors background)
- 🎯 Clean & Minimal → Animate UI (subtle fade-ins, smooth transitions)
- 🎨 Trendy & Social → Aceternity UI + React Bits (3D cards, text reveal, gradient backgrounds)

Let the team decide: page count, product name, color preferences.

### Step 2: Wire Up Core Features

Connect the backend APIs to the UI. Direction-specific approaches:

For **Recruitment tool**:
> "Add a recruitment page with a form: job type selector, region, salary, contact info, platform selector. On submit, call the `recruit` API and display the generated copy + poster image. Show real-time progress during generation."

For **Worker profiles**:
> "Add a data import page where users can paste raw worker info. Call `ingest` API on submit and display structured results. Add a search page that calls `search` API and shows result cards."

For **Smart matching**:
> "Add a chat-like interface where users type their requirements. Call `match` API and display recommendation cards with name, score, and reason for each candidate."

> **Tip:** Complete one feature at a time. Show the result to the team immediately — keep momentum and excitement.

### Step 3: Polish & Enhance

Core features done. Add extra features as the team requests:
- History panel, comparison views, stats dashboards
- Additional animations and transitions
- Custom branding and color adjustments
- Any other feature the team wants to try

---

## APIs

### 1. `recruit(input, onProgress)` — Recruitment Content Generation

Generates platform-specific copywriting + poster image from job requirements.

**Pipeline:** User input → Sonnet generates copy → Sonnet converts to image prompt → Gemini generates poster (~38s)

```typescript
import { autoRegister, recruit } from "./src";

autoRegister();

const result = await recruit({
  position: "月嫂",           // Job type: 月嫂/育儿嫂/保洁/保姆/护工/钟点工
  region: "上海",             // Region
  salary: "8000-15000元/月",  // Salary range
  contact: "13800138000",     // Contact info (phone or WeChat)
  platform: "小红书",         // Target platform: 小红书/抖音/朋友圈/招聘网站/公众号
  extra: "",                  // Optional free-text requirements
}, (event) => {
  // Real-time progress callback
  // event.step:    "文案生成" | "提示词生成" | "海报生成"
  // event.status:  "running" | "done" | "error" | "retry"
  // event.message: Human-readable status text
  console.log(`[${event.step}] ${event.status}: ${event.message}`);
});

// result.copy       → { title: string, content: string, hashtags: string[] }
// result.imagePrompt → English image prompt used for generation
// result.imageUrl   → Generated poster image URL
```

### 2. `ingest(inputs, onProgress)` — Data Ingestion & Structuring

Takes raw unstructured data (chat logs, notes, reviews, anything) about domestic workers → LLM extracts structured profiles → stores in LanceDB vector database. (~24s for 3 records)

```typescript
import { autoRegister, ingest } from "./src";

autoRegister();

const profiles = await ingest([
  { raw: "张阿姨48岁，月嫂8年经验，擅长月子餐...", source: "chat-log" },
  { raw: "李姐保洁3年，收纳整理强项...", source: "review" },
], (event) => {
  // event.step: "数据处理" | "向量存储"
  console.log(`[${event.step}] ${event.status}: ${event.message}`);
});

// profiles → [{ id, name, text, profile: { skills, experience_years, region, ... }, source, vector }]
```

### 3. `search(query, limit)` — Semantic Search

Lightweight vector search against LanceDB. No LLM call, just embedding + distance. (~1s)

```typescript
import { autoRegister, search } from "./src";

autoRegister();

const results = await search("会做月子餐的阿姨", 5);
// results → [{ id, name, text, profile, score }]
// Lower score = better match (vector distance)
```

### 4. `match(query, onProgress)` — Smart Matching & Recommendation

Semantic search + Sonnet evaluation. Returns ranked candidates with human-readable reasons from the user's perspective. (~12s)

```typescript
import { autoRegister, match } from "./src";

autoRegister();

const result = await match(
  "找个会做月子餐、性格温柔的月嫂",
  (event) => {
    // event.step: "候选搜索" | "智能评估"
    console.log(`[${event.step}] ${event.status}: ${event.message}`);
  },
);

// result.query   → Original query string
// result.results → [{ rank, name, score (1-10), reason, profile }]
```

### Async Mode — Non-blocking with Task Management

All APIs have async versions that return a `taskId` immediately. Tasks run in the background. You can fire multiple tasks in parallel and track each one's progress independently.

```typescript
import {
  autoRegister,
  recruitAsync, ingestAsync, matchAsync,
  onTaskUpdate, getTask, getAllTasks,
  addCustomStep, completeCustomStep,
} from "./src";

autoRegister();

// Fire multiple tasks at once — they run in parallel
const task1 = recruitAsync({ position: "月嫂", region: "上海", salary: "8K-15K", contact: "138xxx", platform: "小红书" });
const task2 = recruitAsync({ position: "保洁", region: "北京", salary: "5K-8K", contact: "139xxx", platform: "抖音" });
const task3 = matchAsync("找个会做月子餐的阿姨");

// Listen to real-time progress on any task
onTaskUpdate(task1, (task) => {
  // task.status → "pending" | "running" | "done" | "error"
  // task.steps  → [{ name, status, message, startedAt, completedAt, data }]
  // task.result → final result when done
  console.log(`Task ${task.id}: ${task.status}`);
  task.steps.forEach(s => console.log(`  [${s.name}] ${s.status}: ${s.message}`));
});

// Add custom steps (frontend AI can inject extra steps for richer progress display)
addCustomStep(task2, "风格适配", "正在根据抖音特点优化排版...");
// ... later
completeCustomStep(task2, "风格适配", "排版优化完成");

// Query any task's state
const t = getTask(task1);   // single task
const all = getAllTasks();   // all tasks
```

**Fixed steps** (built into SDK, always reported):
- recruit: `文案生成 → 提示词生成 → 海报生成`
- ingest: `数据处理 → 向量存储`
- match: `候选搜索 → 智能评估`

**Custom steps** (frontend AI adds freely): any name, injected at any point. Use these to show extra loading states, tips, or decorative progress messages.

---

## Frontend Tech Stack

### Core (always use)

| Package | Purpose |
|---------|---------|
| `next` | React framework, file-based routing, SSR |
| `tailwindcss` | Utility-first CSS |
| `shadcn/ui` | Base component library (buttons, forms, cards, dialogs) |
| `framer-motion` | Animation engine (required by Aceternity & Magic UI) |
| `lucide-react` | Icon library |

### Effect Libraries (pick per style)

| Library | Install | Best effects | Style match |
|---------|---------|-------------|-------------|
| **[Aceternity UI](https://ui.aceternity.com/)** | Copy-paste from site | 3D cards, spotlight, parallax scroll, text generate, meteors, moving borders, lamp effect | 🏢 Professional, 🎨 Trendy |
| **[Magic UI](https://magicui.design/)** | `npx magicui-cli add` | Shimmer buttons, animated borders, marquee, globe, dock, particles | 🌸 Warm, 🎯 Minimal |
| **[React Bits](https://reactbits.dev/)** | Copy-paste from site | Animated text, background effects, interactive components | 🎨 Trendy |
| **[Animate UI](https://animate-ui.com/)** | Copy-paste from site | Fade, slide, scale transitions, accordion, tabs | 🎯 Minimal |

> **Usage:** These are all copy-paste component libraries — browse their sites, pick components, paste into project. They all use Tailwind + Framer Motion under the hood, so they work together seamlessly.

### Effect Ideas by Page Type

| Page | Recommended effects |
|------|-------------------|
| Landing / Homepage | Spotlight hero, animated text reveal, particle background |
| Form pages | Shimmer submit button, step progress animation |
| Results / Cards | 3D hover cards, staggered fade-in, moving borders |
| Search / Match | Skeleton loading, typewriter effect for AI responses |
| Dashboard | Animated counters, chart transitions, marquee stats |

---

## Architecture

### Model Roles

| Client | Model | Purpose |
|--------|-------|---------|
| `text` | Claude Sonnet 4.6 | Creative tasks: copywriting, prompt conversion, evaluation |
| `fast` | Claude Haiku 4.5 | Fast extraction: data structuring |
| `image` | Gemini 3.1 Flash | Image generation |
| — | text-embedding-3-small | Vector embeddings |

All models are accessed through a single OpenAI-compatible proxy.

### Storage

**LanceDB** — embedded vector database, data stored locally in `./swan-data/`. Zero external dependencies, no server required.

### Reliability

- Each step has independent try/catch — one failure doesn't break others
- `withRetry()` — automatic retry with timeout control (configurable)
- Fallback chains: Sonnet fails → Gemini fallback for text; AI evaluation fails → vector distance ranking
- Real-time progress via `onProgress` callback — wire this to UI loading states

### Client Management

`autoRegister()` reads environment variables and registers three clients (text/fast/image). See `.env.example` for required variables.

---

## Project Structure

```
src/
├── index.ts        # All exports: autoRegister, recruit, ingest, search, match
├── client.ts       # Multi-model client registry (text/fast/image)
├── retry.ts        # Retry + timeout utility
├── types.ts        # TypeScript types for all APIs
├── recruit.ts      # Recruitment content generation (copy + poster)
├── structify.ts    # Data ingestion + semantic search (LanceDB)
└── match.ts        # Smart matching & recommendation

bdd/
├── features/       # BDD feature files (specs + living docs)
│   ├── recruit-poster.feature
│   ├── structify.feature
│   └── match.feature
├── steps/          # Step implementations
└── run.test.ts     # Test entry point
```

## Setup

```bash
bun install          # Install dependencies
cp .env.example .env # Configure API keys
bun test bdd/        # Run all BDD tests to verify APIs are working
bun run build        # Build for distribution
```

## Contingency

- **API timeout/failure:** Built-in retry handles most cases. If persistent, skip and move to next feature.
- **Network issues:** Switch to mobile hotspot.
- **UI rendering issues:** Check browser console, fix and reload.
- **LanceDB data issues:** Delete `./swan-data/` directory and re-run `ingest` to start fresh.
