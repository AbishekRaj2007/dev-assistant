# ⚡ dev-assist

> An AI-powered CLI that understands your entire codebase — ask questions, explain code, generate tests, and write new features. Powered by **Groq** (free tier, blazing fast).

---

## Features

| Command | What it does |
|---|---|
| `ask` | Ask any question about your codebase |
| `explain` | Get a deep explanation of any file |
| `test` | Auto-generate tests for a file |
| `generate` | Generate new code matching your project style |
| `chat` | Interactive session (REPL mode) |

---

## Setup

### 1. Install dependencies

```bash
npm install
npm run build
```

### 2. Get a free Groq API key

Go to [https://console.groq.com](https://console.groq.com) → Sign up → Create API key (free, no credit card needed).

### 3. Set your API key

```bash
node dist/index.js config
# or
node dist/index.js config --key gsk_YOUR_KEY_HERE
# or via env var
export GROQ_API_KEY=gsk_YOUR_KEY_HERE
```

### 4. (Optional) Install globally

```bash
npm link
# Now you can use: dev-assist <command>
```

---

## Usage

### Ask questions about your codebase

```bash
dev-assist ask "How does authentication work?" -d ./my-project
dev-assist ask "What does the UserService class do?" -d .
dev-assist ask "Where is the database connection initialized?" -f src/db.ts
```

### Explain a file

```bash
dev-assist explain -f src/middleware/auth.ts -d .
dev-assist explain -f src/utils/parser.ts -t "the parseDate function specifically"
```

### Generate tests

```bash
dev-assist test -f src/utils/helpers.ts -d .
dev-assist test -f src/api/users.ts -i "focus on error cases"
# Save directly to a file:
dev-assist test -f src/utils/helpers.ts > src/utils/helpers.test.ts
```

### Generate new code

```bash
dev-assist generate "add a rate limiting middleware using Redis" -d .
dev-assist generate "create a pagination utility function" -d .
dev-assist generate "add input validation to the login endpoint"
```

### Interactive chat mode

```bash
dev-assist chat -d ./my-project
# Then type:
# > ask How does auth work?
# > explain src/routes/api.ts
# > test src/utils.ts
# > generate add error logging middleware
# > exit
```

---

## How it works

```
Your project files
       │
       ▼
  codebase.ts          ← reads & indexes all source files (ignores node_modules, dist etc.)
       │
       ▼
  assistant.ts         ← builds context prompt + calls Groq API (llama-3.3-70b)
       │
       ▼
  formatter.ts         ← renders response with syntax highlighting in terminal
```

The full codebase is sent as context in each request (up to 80 files, 150KB each). For large projects, it prioritizes the focus file you specify with `-f`.

---

## Project Structure

```
dev-assistant-cli/
├── src/
│   ├── index.ts        ← CLI commands (Commander.js)
│   ├── assistant.ts    ← Groq AI client + prompt modes
│   ├── codebase.ts     ← File reader + context builder
│   ├── formatter.ts    ← Terminal output + colors
│   └── config.ts       ← API key storage
├── dist/               ← Compiled output (after npm run build)
├── tsconfig.json
└── package.json
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq API key (alternative to `dev-assist config`) |

---

## Extending this project (ideas)

- **Conversation memory** — maintain multi-turn chat history per session
- **File watching** — auto-reload codebase context when files change
- **Output to file** — `--output <file>` flag to save generated code directly
- **Git diff mode** — only send changed files as context
- **Token budget** — smarter chunking for very large codebases using embeddings + RAG
- **Plugin system** — custom modes (security audit, performance review, etc.)

---

## Model

Uses `llama-3.3-70b-versatile` via Groq — the best free model for code tasks with very low latency.
