import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

type Mode = "ask" | "explain" | "test" | "generate"

const SYSTEM_PROMPTS: Record<Mode, string> = {
  ask: `You are an expert software engineer acting as a codebase assistant.
You have been given context from the user's GitHub repository. Answer questions accurately,
reference specific files when relevant, and be concise but thorough.
Format code snippets with proper markdown code blocks with language tags.`,

  explain: `You are an expert software engineer. Explain code clearly.
- Start with a one-line summary of what it does
- Explain the "why" not just the "what"
- Point out important patterns, algorithms, or design decisions
- Mention potential issues or gotchas
Use simple language, don't oversimplify.`,

  test: `You are an expert software engineer specializing in testing.
Generate comprehensive tests for the given code.
- Detect the testing framework from context (Jest, Vitest, Pytest, etc.) and use it
- Cover: happy path, edge cases, error cases, boundary conditions
- Add a brief comment above each test describing what it tests
- Output ONLY the test file content, no explanation outside code blocks
- Include all necessary imports`,

  generate: `You are an expert software engineer. Generate clean, production-quality code.
- Match the coding style, patterns, and conventions of the existing codebase
- Use the same libraries and frameworks already present
- Handle errors appropriately
- Output the code first, then a brief explanation of key decisions`,
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
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 })
    }

    const { owner, repo } = parsed

    const ghHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "dev-assistant",
    }
    if (process.env.GITHUB_TOKEN) {
      ghHeaders.Authorization = `token ${process.env.GITHUB_TOKEN}`
    }

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
    const repoContext = contextBlock
      ? `Repository: ${owner}/${repo}\n\n${contextBlock}`
      : `Repository: ${owner}/${repo} (could not fetch file contents)`

    const userMessage = `${repoContext}\n\n=== QUESTION ===\n${question}`

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
      max_tokens: 2048,
    })

    const content =
      completion.choices[0]?.message?.content ?? "No response received."

    return NextResponse.json({ content })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
