#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import path from "path";
import { readCodebase } from "./codebase.js";
import { DevAssistant } from "./assistant.js";
import { getApiKey, setApiKey } from "./config.js";
import {
  printBanner,
  printResponse,
  printInfo,
  printSuccess,
  printError,
  printWarning,
  printCodebaseStats,
} from "./formatter.js";

const program = new Command();

// ─── Helpers ────────────────────────────────────────────────

async function getAssistant(): Promise<DevAssistant> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    printError("No Groq API key found.");
    printInfo(
      "Run: dev-assist config --key YOUR_KEY  or  set GROQ_API_KEY env var"
    );
    printInfo("Get a free key at: https://console.groq.com");
    process.exit(1);
  }
  return new DevAssistant(apiKey);
}

async function loadDir(dir: string) {
  const spinner = ora(chalk.cyan("Reading codebase...")).start();
  try {
    const codebase = await readCodebase(dir);
    spinner.succeed(chalk.green("Codebase loaded"));
    printCodebaseStats(codebase.summary, codebase.rootDir);
    return codebase;
  } catch (err: unknown) {
    spinner.fail("Failed to read codebase");
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─── CLI Setup ──────────────────────────────────────────────

program
  .name("dev-assist")
  .description(
    chalk.cyan("⚡ AI-powered dev assistant for your codebase") +
      chalk.gray(" | Powered by Groq")
  )
  .version("1.0.0");

// ─── config command ─────────────────────────────────────────
program
  .command("config")
  .description("Set up your Groq API key")
  .option("-k, --key <apiKey>", "Set Groq API key")
  .action(async (options) => {
    if (options.key) {
      await setApiKey(options.key);
      printSuccess("API key saved to ~/.dev-assistant/config.json");
      return;
    }

    const { key } = await inquirer.prompt([
      {
        type: "password",
        name: "key",
        message: "Enter your Groq API key:",
        mask: "*",
        validate: (v) => (v.length > 0 ? true : "Key cannot be empty"),
      },
    ]);
    await setApiKey(key);
    printSuccess("API key saved!");
    printInfo("Get a free key at https://console.groq.com");
  });

// ─── ask command ────────────────────────────────────────────
program
  .command("ask <question>")
  .description("Ask any question about your codebase")
  .option("-d, --dir <path>", "Project directory", ".")
  .option("-f, --file <file>", "Focus on a specific file")
  .action(async (question: string, options) => {
    const assistant = await getAssistant();
    const codebase = await loadDir(options.dir);
    assistant.setCodebase(codebase);

    const spinner = ora(chalk.cyan("Thinking...")).start();
    try {
      const response = await assistant.ask(question, options.file);
      spinner.stop();
      printResponse(response.content, "ask");
      if (response.tokensUsed) {
        printInfo(`Tokens used: ${response.tokensUsed}`);
      }
    } catch (err: unknown) {
      spinner.fail("Request failed");
      printError(err instanceof Error ? err.message : String(err));
    }
  });

// ─── explain command ────────────────────────────────────────
program
  .command("explain")
  .description("Explain a file or code snippet")
  .option("-d, --dir <path>", "Project directory", ".")
  .option("-f, --file <file>", "File to explain (required)")
  .option("-t, --target <what>", "What specifically to explain", "everything")
  .action(async (options) => {
    if (!options.file) {
      printWarning("Please specify a file with -f <filename>");
      printInfo("Example: dev-assist explain -f src/index.ts");
      process.exit(1);
    }

    const assistant = await getAssistant();
    const codebase = await loadDir(options.dir);
    assistant.setCodebase(codebase);

    const spinner = ora(chalk.cyan(`Explaining ${options.file}...`)).start();
    try {
      const response = await assistant.explain(options.target, options.file);
      spinner.stop();
      printResponse(response.content, "explain");
    } catch (err: unknown) {
      spinner.fail("Request failed");
      printError(err instanceof Error ? err.message : String(err));
    }
  });

// ─── test command ───────────────────────────────────────────
program
  .command("test")
  .description("Generate tests for a file")
  .option("-d, --dir <path>", "Project directory", ".")
  .option("-f, --file <file>", "File to generate tests for (required)")
  .option("-i, --instructions <extra>", "Extra test instructions", "")
  .action(async (options) => {
    if (!options.file) {
      printWarning("Please specify a file with -f <filename>");
      printInfo("Example: dev-assist test -f src/utils.ts");
      process.exit(1);
    }

    const assistant = await getAssistant();
    const codebase = await loadDir(options.dir);
    assistant.setCodebase(codebase);

    const spinner = ora(
      chalk.cyan(`Generating tests for ${options.file}...`)
    ).start();
    try {
      const response = await assistant.generateTests(
        options.instructions,
        options.file
      );
      spinner.stop();
      printResponse(response.content, "test");

      // Suggest output file
      const testFile = options.file
        .replace(/\.(ts|js)$/, ".test.$1")
        .replace("src/", "src/");
      printInfo(`Suggested test file: ${testFile}`);
      printInfo(
        `Tip: dev-assist test -f ${options.file} > ${testFile}  to save directly`
      );
    } catch (err: unknown) {
      spinner.fail("Request failed");
      printError(err instanceof Error ? err.message : String(err));
    }
  });

// ─── generate command ────────────────────────────────────────
program
  .command("generate <prompt>")
  .description("Generate new code from a description")
  .option("-d, --dir <path>", "Project directory", ".")
  .action(async (prompt: string, options) => {
    const assistant = await getAssistant();
    const codebase = await loadDir(options.dir);
    assistant.setCodebase(codebase);

    const spinner = ora(chalk.cyan("Generating code...")).start();
    try {
      const response = await assistant.generate(prompt);
      spinner.stop();
      printResponse(response.content, "generate");
    } catch (err: unknown) {
      spinner.fail("Request failed");
      printError(err instanceof Error ? err.message : String(err));
    }
  });

// ─── interactive mode ───────────────────────────────────────
program
  .command("chat")
  .description("Start an interactive chat session about your codebase")
  .option("-d, --dir <path>", "Project directory", ".")
  .action(async (options) => {
    printBanner();

    const assistant = await getAssistant();
    const codebase = await loadDir(options.dir);
    assistant.setCodebase(codebase);

    printInfo("Interactive mode — type 'exit' to quit");
    printInfo(
      "Commands: ask <question> | explain <file> | test <file> | generate <prompt>"
    );
    console.log();

    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: chalk.cyan("dev-assist>"),
          prefix: "",
        },
      ]);

      const trimmed = input.trim();
      if (!trimmed || trimmed === "exit" || trimmed === "quit") {
        printInfo("Bye! 👋");
        break;
      }

      const [cmd, ...rest] = trimmed.split(" ");
      const arg = rest.join(" ");

      const spinner = ora(chalk.cyan("Thinking...")).start();
      try {
        let response;
        switch (cmd) {
          case "ask":
            response = await assistant.ask(arg);
            break;
          case "explain":
            response = await assistant.explain("everything", arg);
            break;
          case "test":
            response = await assistant.generateTests("", arg);
            break;
          case "generate":
            response = await assistant.generate(arg);
            break;
          default:
            // treat entire input as a question
            response = await assistant.ask(trimmed);
        }
        spinner.stop();
        printResponse(response.content, response.mode);
      } catch (err: unknown) {
        spinner.fail("Request failed");
        printError(err instanceof Error ? err.message : String(err));
      }
    }
  });

// ─── Run ─────────────────────────────────────────────────────
program.addHelpText(
  "after",
  `
${chalk.cyan("Examples:")}
  ${chalk.gray("$")} dev-assist config                          ${chalk.gray("# Set API key")}
  ${chalk.gray("$")} dev-assist ask "How does auth work?" -d .  ${chalk.gray("# Ask a question")}
  ${chalk.gray("$")} dev-assist explain -f src/utils.ts         ${chalk.gray("# Explain a file")}
  ${chalk.gray("$")} dev-assist test -f src/api.ts              ${chalk.gray("# Generate tests")}
  ${chalk.gray("$")} dev-assist generate "add rate limiting"    ${chalk.gray("# Generate code")}
  ${chalk.gray("$")} dev-assist chat -d ./my-project            ${chalk.gray("# Interactive mode")}

${chalk.cyan("Setup:")}
  Get a free Groq API key at ${chalk.underline("https://console.groq.com")}
`
);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}
