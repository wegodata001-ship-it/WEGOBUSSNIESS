import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function findClosingQuote(value: string, quote: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === quote && value[index - 1] !== "\\") {
      return index;
    }
  }
  return -1;
}

export function loadEnvFile(fileName: string, override = false) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return false;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      index += 1;
      continue;
    }

    const separator = rawLine.indexOf("=");
    if (separator === -1) {
      index += 1;
      continue;
    }

    const key = rawLine.slice(0, separator).trim();
    let value = rawLine.slice(separator + 1);
    const trimmedStart = value.trimStart();
    const quote = trimmedStart.startsWith("\"")
      ? "\""
      : trimmedStart.startsWith("'")
        ? "'"
        : "";

    if (quote) {
      value = trimmedStart.slice(1);
      while (true) {
        const closing = findClosingQuote(value, quote);
        if (closing !== -1) {
          value = value.slice(0, closing);
          break;
        }
        index += 1;
        if (index >= lines.length) break;
        value += `\n${lines[index]}`;
      }
    } else {
      value = stripWrappingQuotes(value);
    }

    if (key && (override || !process.env[key])) {
      process.env[key] = value;
    }

    index += 1;
  }

  return true;
}

export function loadProjectEnv() {
  loadEnvFile(".env");
  return loadEnvFile(".env.local", true);
}

export function normalizePrivateKey(raw: string) {
  let key = raw.trim();
  if (
    (key.startsWith("\"") && key.endsWith("\""))
    || (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  return key.replace(/\\n/g, "\n").trim();
}
