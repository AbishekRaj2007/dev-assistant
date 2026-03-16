import { NextRequest, NextResponse } from "next/server"

const BINARY_EXTENSIONS = new Set([
  "png","jpg","jpeg","gif","webp","svg","ico","bmp","tiff",
  "woff","woff2","ttf","eot","otf",
  "pdf","zip","tar","gz","7z","rar",
  "exe","dll","so","dylib","jar","class","pyc",
  "mp3","mp4","avi","mov","wav","ogg",
])

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const clean = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "")
  const parts = clean.replace(/\.git$/, "").split("/")
  if (!parts[0] || !parts[1]) return null
  return { owner: parts[0], repo: parts[1] }
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java",
    kt: "kotlin", rb: "ruby", php: "php", cs: "csharp",
    cpp: "cpp", c: "c", h: "c", md: "markdown", json: "json",
    yaml: "yaml", yml: "yaml", toml: "toml", sh: "bash",
    bash: "bash", zsh: "bash", css: "css", scss: "css",
    html: "html", xml: "xml", sql: "sql", graphql: "graphql",
    env: "bash", lock: "plaintext", gitignore: "bash",
    dockerfile: "dockerfile", makefile: "makefile",
    swift: "swift", dart: "dart", r: "r", lua: "lua",
  }
  return langMap[ext] ?? "plaintext"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const repoUrl: string = body?.repoUrl?.trim() ?? ""
    const filePath: string = body?.filePath?.trim() ?? ""

    if (!filePath) {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 })
    }

    // Block binary file extensions early
    const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
    if (BINARY_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Binary files cannot be displayed as text" },
        { status: 415 }
      )
    }

    const parsed = parseGitHubUrl(repoUrl)
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 })
    }

    const { owner, repo } = parsed

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "dev-assistant",
    }
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      { headers }
    )

    if (!res.ok) {
      const msg = res.status === 404 ? "File not found" : "GitHub API error"
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    const data = await res.json()

    // GitHub returns base64-encoded content for files up to ~1 MB
    if (data.encoding === "base64" && typeof data.content === "string") {
      const content = Buffer.from(data.content, "base64").toString("utf-8")
      return NextResponse.json({
        content,
        language: detectLanguage(filePath),
        size: data.size as number,
      })
    }

    // Files >1 MB: GitHub omits content and returns a download_url instead
    if (data.download_url) {
      return NextResponse.json(
        { error: "File is too large to display inline (>1 MB)" },
        { status: 413 }
      )
    }

    return NextResponse.json(
      { error: "Unable to decode file content" },
      { status: 422 }
    )
  } catch {
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 })
  }
}
