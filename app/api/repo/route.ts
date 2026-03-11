import { NextRequest, NextResponse } from "next/server"

interface FileNode {
  name: string
  type: "file" | "folder"
  path?: string
  children?: FileNode[]
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const clean = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "")
  const parts = clean.replace(/\.git$/, "").split("/")
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) return null
  return { owner, repo }
}

function buildFileTree(
  items: { path: string; type: string }[],
  limit = 400
): FileNode[] {
  const root: FileNode[] = []
  const nodeMap = new Map<string, FileNode>()

  const sorted = [...items]
    .filter((i) => i.type === "blob" || i.type === "tree")
    .slice(0, limit)
    .sort((a, b) => a.path.localeCompare(b.path))

  for (const item of sorted) {
    const parts = item.path.split("/")
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join("/")

    const node: FileNode = {
      name,
      type: item.type === "tree" ? "folder" : "file",
      path: item.path,
      ...(item.type === "tree" ? { children: [] } : {}),
    }

    nodeMap.set(item.path, node)

    if (!parentPath) {
      root.push(node)
    } else {
      nodeMap.get(parentPath)?.children?.push(node)
    }
  }

  return root
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const repoUrl: string = body?.repoUrl?.trim() ?? ""
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

    const [repoRes, treeRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
        { headers }
      ),
    ])

    if (!repoRes.ok) {
      const msg =
        repoRes.status === 404
          ? "Repository not found"
          : "GitHub API error — you may need a GITHUB_TOKEN for private repos"
      return NextResponse.json({ error: msg }, { status: repoRes.status })
    }

    const [repoData, treeData] = await Promise.all([
      repoRes.json(),
      treeRes.ok ? treeRes.json() : Promise.resolve({ tree: [] }),
    ])

    return NextResponse.json({
      repoInfo: {
        name: repoData.name,
        owner: repoData.owner.login,
        avatar: repoData.owner.avatar_url,
        stars: repoData.stargazers_count,
        language: repoData.language ?? "Unknown",
        description: repoData.description ?? "",
      },
      fileTree: buildFileTree(treeData.tree ?? []),
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch repository" },
      { status: 500 }
    )
  }
}
