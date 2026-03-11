import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

export interface CodeFile {
  path: string;
  relativePath: string;
  content: string;
  language: string;
  lines: number;
}

export interface CodebaseContext {
  files: CodeFile[];
  totalFiles: number;
  totalLines: number;
  rootDir: string;
  summary: string;
}

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".cpp": "C++",
  ".c": "C",
  ".cs": "C#",
  ".php": "PHP",
  ".rb": "Ruby",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".json": "JSON",
  ".md": "Markdown",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".env.example": "Environment",
  ".sh": "Shell",
  ".sql": "SQL",
};

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
];

const MAX_FILE_SIZE_KB = 150;
const MAX_TOTAL_FILES = 80;

export async function readCodebase(rootDir: string): Promise<CodebaseContext> {
  const absRoot = path.resolve(rootDir);

  if (!(await fs.pathExists(absRoot))) {
    throw new Error(`Directory not found: ${absRoot}`);
  }

  const extensions = Object.keys(SUPPORTED_EXTENSIONS);
  const patterns = extensions.map((ext) => `**/*${ext}`);

  const filePaths = await glob(patterns, {
    cwd: absRoot,
    ignore: IGNORE_PATTERNS,
    absolute: true,
  });

  const files: CodeFile[] = [];

  for (const filePath of filePaths.slice(0, MAX_TOTAL_FILES)) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_FILE_SIZE_KB * 1024) continue;

      const content = await fs.readFile(filePath, "utf-8");
      const ext = path.extname(filePath);
      const relativePath = path.relative(absRoot, filePath);

      files.push({
        path: filePath,
        relativePath,
        content,
        language: SUPPORTED_EXTENSIONS[ext] || "Unknown",
        lines: content.split("\n").length,
      });
    } catch {
      // skip unreadable files
    }
  }

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

  // Build a summary of the codebase structure
  const langCounts: Record<string, number> = {};
  for (const f of files) {
    langCounts[f.language] = (langCounts[f.language] || 0) + 1;
  }
  const langSummary = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${lang} (${count} files)`)
    .join(", ");

  const summary = `${files.length} files | ${totalLines} lines | Languages: ${langSummary}`;

  return {
    files,
    totalFiles: files.length,
    totalLines,
    rootDir: absRoot,
    summary,
  };
}

export function buildContextPrompt(
  codebase: CodebaseContext,
  focusFile?: string
): string {
  let context = `You are analyzing a codebase at: ${codebase.rootDir}\n`;
  context += `Codebase summary: ${codebase.summary}\n\n`;
  context += `=== FILE TREE ===\n`;
  context += codebase.files.map((f) => `  ${f.relativePath}`).join("\n");
  context += `\n\n=== FILE CONTENTS ===\n`;

  // If focus file specified, put it first
  const sorted = focusFile
    ? [
        ...codebase.files.filter((f) => f.relativePath.includes(focusFile)),
        ...codebase.files.filter((f) => !f.relativePath.includes(focusFile)),
      ]
    : codebase.files;

  for (const file of sorted) {
    context += `\n--- ${file.relativePath} (${file.language}, ${file.lines} lines) ---\n`;
    context += file.content;
    context += `\n`;
  }

  return context;
}
