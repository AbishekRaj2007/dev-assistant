import Groq from "groq-sdk";
import { CodebaseContext, buildContextPrompt } from "./codebase.js";

export type AssistantMode = "ask" | "test" | "explain" | "generate";

export interface AssistantResponse {
  content: string;
  mode: AssistantMode;
  tokensUsed?: number;
}

const MODEL = "llama-3.3-70b-versatile"; // Best free Groq model for code

const SYSTEM_PROMPTS: Record<AssistantMode, string> = {
  ask: `You are an expert software engineer acting as a codebase assistant. 
You have been given full access to the user's codebase. Answer questions accurately, 
reference specific files and line numbers when relevant, and be concise but thorough.
Format code snippets with proper markdown code blocks with language tags.`,

  explain: `You are an expert software engineer. Your job is to explain code clearly.
When explaining:
- Start with a one-line summary of what it does
- Explain the "why" not just the "what"  
- Point out any important patterns, algorithms, or design decisions
- Mention any potential issues or things to watch out for
- Use simple language but don't oversimplify
Format code references with backticks.`,

  test: `You are an expert software engineer specializing in testing.
Your job is to generate comprehensive tests for the given code.
Rules:
- Detect the testing framework from the codebase (Jest, Vitest, Pytest, etc.) and use it
- If no framework found, default to Jest for JS/TS, pytest for Python
- Write tests that cover: happy path, edge cases, error cases, boundary conditions
- Add a brief comment above each test describing what it tests
- Make tests readable and self-documenting
- Output ONLY the test file content, no explanation outside code blocks
- Include all necessary imports`,

  generate: `You are an expert software engineer. Generate clean, production-quality code.
Rules:
- Match the coding style, patterns, and conventions of the existing codebase
- Use the same libraries and frameworks already present
- Add JSDoc/TSDoc comments for functions
- Handle errors appropriately
- Follow SOLID principles
- Output the code first, then a brief explanation of key decisions`,
};

export class DevAssistant {
  private groq: Groq;
  private codebase: CodebaseContext | null = null;

  constructor(apiKey: string) {
    this.groq = new Groq({ apiKey });
  }

  setCodebase(codebase: CodebaseContext) {
    this.codebase = codebase;
  }

  async ask(question: string, focusFile?: string): Promise<AssistantResponse> {
    const contextPrompt = this.codebase
      ? buildContextPrompt(this.codebase, focusFile)
      : "No codebase loaded.";

    const userMessage = `${contextPrompt}\n\n=== QUESTION ===\n${question}`;

    return this.callGroq("ask", userMessage);
  }

  async explain(target: string, focusFile?: string): Promise<AssistantResponse> {
    const contextPrompt = this.codebase
      ? buildContextPrompt(this.codebase, focusFile)
      : "";

    const userMessage = focusFile
      ? `${contextPrompt}\n\n=== EXPLAIN THIS ===\nExplain the code in: ${focusFile}\nSpecifically: ${target}`
      : `Explain this code:\n\`\`\`\n${target}\n\`\`\``;

    return this.callGroq("explain", userMessage);
  }

  async generateTests(
    target: string,
    focusFile?: string
  ): Promise<AssistantResponse> {
    const contextPrompt = this.codebase
      ? buildContextPrompt(this.codebase, focusFile)
      : "";

    const userMessage = focusFile
      ? `${contextPrompt}\n\n=== GENERATE TESTS ===\nGenerate comprehensive tests for: ${focusFile}\nAdditional instructions: ${target}`
      : `Generate comprehensive tests for this code:\n\`\`\`\n${target}\n\`\`\``;

    return this.callGroq("test", userMessage);
  }

  async generate(prompt: string): Promise<AssistantResponse> {
    const contextPrompt = this.codebase
      ? buildContextPrompt(this.codebase)
      : "No codebase loaded. Generate standalone code.";

    const userMessage = `${contextPrompt}\n\n=== GENERATE REQUEST ===\n${prompt}`;

    return this.callGroq("generate", userMessage);
  }

  private async callGroq(
    mode: AssistantMode,
    userMessage: string
  ): Promise<AssistantResponse> {
    const completion = await this.groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[mode] },
        { role: "user", content: userMessage },
      ],
      temperature: mode === "test" || mode === "generate" ? 0.2 : 0.5,
      max_tokens: 4096,
    });

    const content =
      completion.choices[0]?.message?.content || "No response received.";
    const tokensUsed = completion.usage?.total_tokens;

    return { content, mode, tokensUsed };
  }
}
