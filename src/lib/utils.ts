import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate short share tokens (e.g. "abc123")
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);
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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    MAX_FILE_SIZE,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    MAX_FILE_SIZE,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    MAX_FILE_SIZE,
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
  "application/x-apple-diskimage": MAX_FILE_SIZE, // DMG
  "application/x-ms-dos-executable": MAX_FILE_SIZE, // EXE
  "application/x-deb": MAX_FILE_SIZE, // DEB
  "application/x-rpm": MAX_FILE_SIZE, // RPM
  "application/java-archive": MAX_FILE_SIZE, // JAR
  "application/x-iso9660-image": MAX_FILE_SIZE, // ISO
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
  _fileName: string,
  fileSize: number,
): { valid: boolean; error?: string } {
  // Reject unknown MIME types
  if (!(mimeType in ALLOWED_TYPES)) {
    return { valid: false, error: "File type not supported." };
  }

  const maxSize = ALLOWED_TYPES[mimeType];
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

// Extract client IP from request headers
export function getClientIp(req: {
  headers: { get(name: string): string | null };
}): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
