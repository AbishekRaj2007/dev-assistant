import fs from "fs-extra";
import path from "path";
import os from "os";

export interface Config {
  groqApiKey?: string;
  defaultModel?: string;
  lastUsedDir?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".dev-assistant");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<Config> {
  try {
    await fs.ensureDir(CONFIG_DIR);
    if (await fs.pathExists(CONFIG_FILE)) {
      return await fs.readJson(CONFIG_FILE);
    }
  } catch {
    // ignore
  }
  return {};
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export async function getApiKey(): Promise<string | null> {
  // 1. Check environment variable first
  if (process.env.GROQ_API_KEY) {
    return process.env.GROQ_API_KEY;
  }
  // 2. Check saved config
  const config = await loadConfig();
  return config.groqApiKey || null;
}

export async function setApiKey(key: string): Promise<void> {
  const config = await loadConfig();
  config.groqApiKey = key;
  await saveConfig(config);
}
