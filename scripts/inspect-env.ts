import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.example",
];

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
];

function inspect(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    console.log(JSON.stringify({
      fileName,
      path: filePath,
      exists: false,
    }));
    return;
  }

  const buffer = readFileSync(filePath);
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);
  const found: Record<string, { empty: boolean; quoted: boolean; valueLength: number }> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!required.includes(key)) continue;
    const value = trimmed.slice(separator + 1);
    const valueTrim = value.trim();
    found[key] = {
      empty: !valueTrim,
      quoted: valueTrim.startsWith("\"") || valueTrim.startsWith("'"),
      valueLength: valueTrim.length,
    };
  }

  const present = required.filter((key) => found[key] && !found[key].empty).length;

  console.log(JSON.stringify({
    fileName,
    path: filePath,
    exists: true,
    size: buffer.length,
    lineCount: lines.length,
    firebaseValuesPresent: `${present}/9`,
    keys: required.map((key) => ({
      key,
      status: !found[key] ? "MISSING" : found[key].empty ? "EMPTY" : "PRESENT",
      quoted: found[key]?.quoted ?? false,
      valueLength: found[key]?.valueLength ?? 0,
    })),
  }, null, 2));
}

for (const fileName of files) {
  inspect(fileName);
}
