import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate short share tokens (e.g. "abc123")
const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  8
);
export function generateShareToken() {
  return nanoid();
}

// Generate R2 storage key
export function generateStorageKey(originalName: string) {
  const now = new Date();
  const ext = originalName.split(".").pop() || "bin";
  const uuid = crypto.randomUUID();
  return `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${uuid}.${ext}`;
}

// Sanitize original file name
export function sanitizeFileName(name: string) {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 255);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

// All allowed MIME types — 10 GB limit each
const ALLOWED_TYPES: Record<string, number> = {
  // Images
  "image/jpeg": MAX_FILE_SIZE,
  "image/png": MAX_FILE_SIZE,
  "image/gif": MAX_FILE_SIZE,
  "image/webp": MAX_FILE_SIZE,
  "image/svg+xml": MAX_FILE_SIZE,
  "image/bmp": MAX_FILE_SIZE,
  "image/tiff": MAX_FILE_SIZE,
  "image/x-icon": MAX_FILE_SIZE,
  // Documents
  "application/pdf": MAX_FILE_SIZE,
  "application/msword": MAX_FILE_SIZE,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": MAX_FILE_SIZE,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": MAX_FILE_SIZE,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": MAX_FILE_SIZE,
  "application/vnd.ms-excel": MAX_FILE_SIZE,
  "application/vnd.ms-powerpoint": MAX_FILE_SIZE,
  // Text
  "text/plain": MAX_FILE_SIZE,
  "text/csv": MAX_FILE_SIZE,
  "text/html": MAX_FILE_SIZE,
  "text/css": MAX_FILE_SIZE,
  "text/xml": MAX_FILE_SIZE,
  // Data
  "application/json": MAX_FILE_SIZE,
  "application/xml": MAX_FILE_SIZE,
  // Archives & compressed
  "application/zip": MAX_FILE_SIZE,
  "application/x-zip-compressed": MAX_FILE_SIZE,
  "application/x-tar": MAX_FILE_SIZE,
  "application/x-7z-compressed": MAX_FILE_SIZE,
  "application/gzip": MAX_FILE_SIZE,
  "application/x-rar-compressed": MAX_FILE_SIZE,
  "application/vnd.rar": MAX_FILE_SIZE,
  // Video
  "video/mp4": MAX_FILE_SIZE,
  "video/webm": MAX_FILE_SIZE,
  "video/ogg": MAX_FILE_SIZE,
  "video/quicktime": MAX_FILE_SIZE,
  "video/x-msvideo": MAX_FILE_SIZE,
  "video/x-matroska": MAX_FILE_SIZE,
  "video/3gpp": MAX_FILE_SIZE,
  "video/mpeg": MAX_FILE_SIZE,
  // Audio
  "audio/mpeg": MAX_FILE_SIZE,
  "audio/wav": MAX_FILE_SIZE,
  "audio/ogg": MAX_FILE_SIZE,
  "audio/mp4": MAX_FILE_SIZE,
  "audio/aac": MAX_FILE_SIZE,
  "audio/flac": MAX_FILE_SIZE,
  "audio/x-flac": MAX_FILE_SIZE,
  "audio/webm": MAX_FILE_SIZE,
  // Applications / executables
  "application/octet-stream": MAX_FILE_SIZE,
  "application/x-msdownload": MAX_FILE_SIZE,
  "application/x-executable": MAX_FILE_SIZE,
  "application/vnd.android.package-archive": MAX_FILE_SIZE, // APK
  "application/x-apple-diskimage": MAX_FILE_SIZE,           // DMG
  "application/x-ms-dos-executable": MAX_FILE_SIZE,         // EXE
  "application/x-deb": MAX_FILE_SIZE,                       // DEB
  "application/x-rpm": MAX_FILE_SIZE,                       // RPM
  "application/java-archive": MAX_FILE_SIZE,                // JAR
  "application/x-iso9660-image": MAX_FILE_SIZE,             // ISO
  "application/x-xz": MAX_FILE_SIZE,
  // Fonts
  "font/ttf": MAX_FILE_SIZE,
  "font/otf": MAX_FILE_SIZE,
  "font/woff": MAX_FILE_SIZE,
  "font/woff2": MAX_FILE_SIZE,
  // 3D / CAD
  "model/stl": MAX_FILE_SIZE,
  "model/obj": MAX_FILE_SIZE,
  "model/gltf+json": MAX_FILE_SIZE,
  "model/gltf-binary": MAX_FILE_SIZE,
  // Misc
  "application/x-sqlite3": MAX_FILE_SIZE,
  "application/x-shockwave-flash": MAX_FILE_SIZE,
  "application/wasm": MAX_FILE_SIZE,
};

export function validateFileType(
  mimeType: string,
  fileName: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // No blocked extensions — allow everything
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  void ext; // unused now but kept for future use

  // If MIME type is known, enforce 10 GB limit
  const maxSize = ALLOWED_TYPES[mimeType] ?? MAX_FILE_SIZE;

  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${formatBytes(maxSize)}.`,
    };
  }

  return { valid: true };
}

// Format bytes to human readable
export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Format date
export function formatDate(date: string | Date | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Parse expiry option to date
export function parseExpiry(option: string): Date | null {
  if (option === "never") return null;
  const now = new Date();
  switch (option) {
    case "1h":
      now.setHours(now.getHours() + 1);
      break;
    case "24h":
      now.setHours(now.getHours() + 24);
      break;
    case "7d":
      now.setDate(now.getDate() + 7);
      break;
    case "30d":
      now.setDate(now.getDate() + 30);
      break;
    default:
      now.setHours(now.getHours() + 24);
  }
  return now;
}

// Detect MIME type from file buffer (simple magic bytes)
export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  const signatures: [number[], string][] = [
    [[0x89, 0x50, 0x4e, 0x47], "image/png"],
    [[0xff, 0xd8, 0xff], "image/jpeg"],
    [[0x47, 0x49, 0x46], "image/gif"],
    [[0x52, 0x49, 0x46, 0x46], "image/webp"], // Actually WEBP starts with RIFF...WEBP
    [[0x25, 0x50, 0x44, 0x46], "application/pdf"],
    [[0x50, 0x4b, 0x03, 0x04], "application/zip"],
    [[0x1f, 0x8b], "application/gzip"],
    [[0x42, 0x5a, 0x68], "application/x-bzip2"],
    [[0x37, 0x7a, 0xbc, 0xaf], "application/x-7z-compressed"],
    [[0x75, 0x73, 0x74, 0x61, 0x72], "application/x-tar"],
  ];

  for (const [sig, mime] of signatures) {
    if (buffer.slice(0, sig.length).toString("hex") === Buffer.from(sig).toString("hex")) {
      return mime;
    }
  }

  // Check for WEBP more specifically (RIFF....WEBP)
  if (
    buffer.slice(0, 4).toString("hex") === "52494646" &&
    buffer.slice(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }

  // Check for SVG
  const start = buffer.slice(0, 256).toString("utf-8").trim().toLowerCase();
  if (start.startsWith("<?xml") || start.startsWith("<svg")) {
    return "image/svg+xml";
  }

  // Check for plain text
  const isText = buffer.slice(0, 512).every((b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e));
  if (isText) return "text/plain";

  return null;
}
