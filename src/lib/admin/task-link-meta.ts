export function linkService(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("docs.google.com")) return { id: "gdocs", label: "Google Docs" };
    if (host.includes("sheets.google.com") || host.includes("spreadsheets")) return { id: "gsheets", label: "Google Sheets" };
    if (host.includes("drive.google.com")) return { id: "gdrive", label: "Google Drive" };
    if (host.includes("figma.com")) return { id: "figma", label: "Figma" };
    if (host.includes("github.com")) return { id: "github", label: "GitHub" };
    if (host.includes("vercel.com")) return { id: "vercel", label: "Vercel" };
    return { id: "web", label: host || "Web" };
  } catch {
    return { id: "web", label: "Web" };
  }
}

export function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function canPreviewFile(contentType: string) {
  return contentType.startsWith("image/") || contentType === "application/pdf";
}
