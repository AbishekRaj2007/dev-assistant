import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

type Mode = "ask" | "explain" | "test" | "generate"

const SYSTEM_PROMPTS: Record<Mode, string> = {
  ask: `You are an expert software engineer acting as a codebase assistant.
You have been given context from the user's GitHub repository. Answer questions accurately,
reference specific files when relevant, and be concise but thorough.
Format code snippets with proper markdown code blocks with language tags.`,

  explain: `You are an expert software engineer. Explain code clearly and thoroughly.
Structure your explanation as follows:
1. **Summary** — one sentence describing what this code does
2. **How it works** — step-by-step walkthrough of the logic
3. **Key patterns & decisions** — notable algorithms, design patterns, or architectural choices
4. **Gotchas / notes** — edge cases, potential issues, or things to watch out for

Use simple language. Always wrap code references in backticks. Use markdown headers and bullet points.`,

  test: `You are an expert software engineer specializing in testing.
Generate a complete, runnable test file for the given code.

Rules:
- Detect the testing framework from the codebase context (Jest, Vitest, Pytest, Go test, etc.) and use it exclusively
- Cover: happy path, edge cases, error/failure cases, boundary conditions
- Add a one-line comment above each test describing what it verifies
- Include ALL necessary imports at the top
- Mock external dependencies (network, DB, filesystem) appropriately
- Output ONLY the complete test file — no explanation text outside the code block
- Use descriptive test names (e.g. "should return null when input is empty")`,

  generate: `You are an expert software engineer. Generate clean, production-quality code.

Rules:
- Exactly match the coding style, patterns, naming conventions, and idioms of the existing codebase
- Use only the libraries and frameworks already present — do not introduce new dependencies
- Include proper error handling and TypeScript types (if the codebase uses TypeScript)
- Output the complete implementation first in a properly tagged code block
- After the code, add a brief "**Notes:**" section (3-5 bullets) explaining key decisions

Do not add placeholder comments like "// TODO" or "// implement this".`,
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const clean = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "")
  const parts = clean.replace(/\.git$/, "").split("/")
  if (!parts[0] || !parts[1]) return null
  return { owner: parts[0], repo: parts[1] }
}

async function fetchFileContent(
  owner: string,
  repo: string,
  filePath: string,
  headers: Record<string, string>
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      { headers }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.encoding === "base64" && typeof data.content === "string") {
      return Buffer.from(data.content, "base64").toString("utf-8")
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GROQ_API_KEY is not set. Add it to your .env.local file and restart the server.",
      },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { repoUrl, question, mode, selectedFile } = body as {
      repoUrl: string
      question: string
      mode: Mode
      selectedFile?: string
    }

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question cannot be empty" }, { status: 400 })
    }

    const parsed = parseGitHubUrl(repoUrl?.trim() ?? "")

    const ghHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "dev-assistant",
    }
    if (process.env.GITHUB_TOKEN) {
      ghHeaders.Authorization = `token ${process.env.GITHUB_TOKEN}`
    }

    let repoContext = ""

    if (parsed) {
      const { owner, repo } = parsed

      // Build list of context files to fetch
      const contextFilePaths = ["README.md", "package.json"]
      if (selectedFile && !contextFilePaths.includes(selectedFile)) {
        contextFilePaths.unshift(selectedFile) // prioritise selected file
      }

      const fetchedContents = await Promise.all(
        contextFilePaths.map(async (f) => {
          const content = await fetchFileContent(owner, repo, f, ghHeaders)
          if (!content) return null
          // Truncate large files to stay within token limits
          const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n... (truncated)" : content
          return `=== ${f} ===\n${truncated}`
        })
      )

      const contextBlock = fetchedContents.filter(Boolean).join("\n\n")
      repoContext = contextBlock
        ? `Repository: ${owner}/${repo}\n\n${contextBlock}`
        : `Repository: ${owner}/${repo} (could not fetch file contents)`
    }

    const userMessage = repoContext
      ? `${repoContext}\n\n=== QUESTION ===\n${question}`
      : question

    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.ask,
        },
        { role: "user", content: userMessage },
      ],
      temperature: mode === "test" || mode === "generate" ? 0.2 : 0.5,
      max_tokens: mode === "test" || mode === "generate" ? 4096 : 2048,
    })

    const content =
      completion.choices[0]?.message?.content ?? "No response received."

    return NextResponse.json({ content })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
