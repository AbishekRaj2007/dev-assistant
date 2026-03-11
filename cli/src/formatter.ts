import chalk from "chalk";

export function printBanner() {
  console.log(
    chalk.cyan(`
  ██████╗ ███████╗██╗   ██╗     █████╗ ███████╗███████╗████████╗
  ██╔══██╗██╔════╝██║   ██║    ██╔══██╗██╔════╝██╔════╝╚══██╔══╝
  ██║  ██║█████╗  ██║   ██║    ███████║███████╗███████╗   ██║   
  ██║  ██║██╔══╝  ╚██╗ ██╔╝    ██╔══██║╚════██║╚════██║   ██║   
  ██████╔╝███████╗ ╚████╔╝     ██║  ██║███████║███████║   ██║   
  ╚═════╝ ╚══════╝  ╚═══╝      ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝  
`)
  );
  console.log(
    chalk.gray("  Your AI-powered codebase companion  ") +
      chalk.yellow("⚡ Powered by Groq\n")
  );
}

export function printResponse(content: string, mode: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modeColors: Record<string, any> = {
    ask: chalk.blue,
    explain: chalk.green,
    test: chalk.magenta,
    generate: chalk.yellow,
  };

  const modeIcons: Record<string, string> = {
    ask: "💬",
    explain: "🔍",
    test: "🧪",
    generate: "⚙️",
  };

  const color = modeColors[mode] || chalk.white;
  const icon = modeIcons[mode] || "▶";

  console.log("\n" + color("─".repeat(60)));
  console.log(color(`${icon}  Response [${mode.toUpperCase()}]`));
  console.log(color("─".repeat(60)) + "\n");

  // Simple syntax highlighting for code blocks in markdown
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBlockLang = "";

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        console.log(chalk.bgGray.white(` ${codeBlockLang || "code"} `));
      } else {
        inCodeBlock = false;
        console.log(chalk.gray("───"));
      }
    } else if (inCodeBlock) {
      console.log(chalk.greenBright(line));
    } else if (line.startsWith("# ")) {
      console.log(chalk.bold.white(line));
    } else if (line.startsWith("## ") || line.startsWith("### ")) {
      console.log(chalk.bold.cyan(line));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      console.log(chalk.gray("  •") + " " + line.slice(2));
    } else if (line.match(/^\d+\. /)) {
      console.log(chalk.yellow(line));
    } else {
      // Inline code
      const formatted = line.replace(/`([^`]+)`/g, (_, code) =>
        chalk.bgBlack.greenBright(` ${code} `)
      );
      console.log(formatted);
    }
  }

  console.log("\n" + color("─".repeat(60)) + "\n");
}

export function printInfo(msg: string) {
  console.log(chalk.cyan("ℹ ") + chalk.gray(msg));
}

export function printSuccess(msg: string) {
  console.log(chalk.green("✓ ") + msg);
}

export function printError(msg: string) {
  console.log(chalk.red("✗ ") + chalk.red(msg));
}

export function printWarning(msg: string) {
  console.log(chalk.yellow("⚠ ") + chalk.yellow(msg));
}

export function printCodebaseStats(summary: string, rootDir: string) {
  console.log("\n" + chalk.bgBlue.white(" CODEBASE LOADED "));
  console.log(chalk.gray(`  Path: ${rootDir}`));
  console.log(chalk.gray(`  ${summary}`));
  console.log();
}
