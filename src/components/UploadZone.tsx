"use client";

import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UploadCloud,
  File as FileIcon,
  FolderOpen,
  X,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

/** Format seconds into a human-readable ETA string, e.g. "2 min 14 s" or "45 s". */
function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}
import { getSupabaseBrowser } from "@/lib/supabase";
import ShareCard from "./ShareCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadResult {
  token: string;
  shareUrl: string;
  name: string;
}

interface FileUploadState {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  result?: UploadResult;
  isFolder?: boolean;
  speed?: number; // bytes per second, rolling average
  eta?: number; // seconds remaining
}

interface MultipartSession {
  token: string;
  shareUrl: string;
  storageKey: string;
  uploadId: string;
  chunkSize: number;
  totalParts: number;
  // Sparse map of partNumber (1-indexed) → presigned URL.
  // The initiate endpoint only returns the first batch; subsequent batches are
  // fetched on-demand just before they are needed so URLs are always fresh.
  partUrls: Record<number, string>;
  completed: Record<number, string>; // partNumber -> ETag
}

interface UploadZoneProps {
  onUploadSuccess?: (token: string, shareUrl: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  defaultCollectionId?: string;
}

const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never" },
];

// ─── Folder helpers ───────────────────────────────────────────────────────────

/** Recursively collect all files from a dropped directory entry */
async function readDirectoryRecursive(
  entry: FileSystemDirectoryEntry,
  path = "",
): Promise<{ file: File; path: string }[]> {
  const results: { file: File; path: string }[] = [];
  const reader = entry.createReader();

  // readEntries returns max 100 items per call — loop until empty
  while (true) {
    const entries: FileSystemEntry[] = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (entries.length === 0) break;

    for (const e of entries) {
      if (e.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (e as FileSystemFileEntry).file(resolve, reject),
        );
        results.push({ file, path: path ? `${path}/${e.name}` : e.name });
      } else if (e.isDirectory) {
        const sub = await readDirectoryRecursive(
          e as FileSystemDirectoryEntry,
          path ? `${path}/${e.name}` : e.name,
        );
        results.push(...sub);
      }
    }
  }

  return results;
}

/** Zip files preserving folder structure, return as a single File */
async function zipEntries(
  folderName: string,
  entries: { file: File; path: string }[],
): Promise<File> {
  const zip = new JSZip();
  const folder = zip.folder(folderName)!;
  for (const { file, path } of entries) {
    folder.file(path, file);
  }
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return new File([blob], `${folderName}.zip`, { type: "application/zip" });
}

// ─── Multipart session persistence (resume across reloads) ────────────────────

const MP_STORAGE_PREFIX = "fileshare_mp_session_";

/** Stable per-file key for persisted multipart sessions. */
function mpStorageKey(file: File): string {
  return `${MP_STORAGE_PREFIX}${file.name}|${file.size}|${file.lastModified}`;
}

/** Load a previously-saved multipart session for this file, if still valid. */
function loadPersistedSession(file: File): MultipartSession | null {
  try {
    const raw = window.localStorage.getItem(mpStorageKey(file));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      session?: Partial<MultipartSession> | null;
    } | null;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    // Presigned part URLs expire after ~4h — treat anything older as stale so we
    // re-initiate a fresh session instead of retrying expired URLs.
    if (Date.now() - parsed.savedAt > 3 * 60 * 60 * 1000) return null;
    const s = parsed.session;
    if (!s || typeof s !== "object") return null;
    if (!s.token || !s.storageKey || !s.uploadId) return null;
    if (typeof s.chunkSize !== "number" || s.chunkSize <= 0) return null;
    if (!Array.isArray(s.partUrls) && typeof s.partUrls !== "object")
      return null;
    const totalParts = Math.ceil(file.size / s.chunkSize);
    if (totalParts !== s.totalParts) {
      return null;
    }
    if (!s.completed || typeof s.completed !== "object") return null;
    return s as MultipartSession;
  } catch {
    return null;
  }
}

/** Persist a multipart session so a reload/resume can continue it. */
function persistSession(file: File, session: MultipartSession): void {
  try {
    window.localStorage.setItem(
      mpStorageKey(file),
      JSON.stringify({ savedAt: Date.now(), session }),
    );
  } catch {
    // Ignore storage quota / security errors — resume is best-effort.
  }
}

/** Remove a persisted session (on success or when explicitly reset). */
function clearPersistedSession(file: File): void {
  try {
    window.localStorage.removeItem(mpStorageKey(file));
  } catch {
    // ignore
  }
}

/** Clear all persisted multipart sessions (used by reset). */
function clearAllPersistedSessions(): void {
  try {
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(MP_STORAGE_PREFIX)) remove.push(key);
    }
    remove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadZone({
  onUploadSuccess,
  onUploadingChange,
  defaultCollectionId,
}: UploadZoneProps = {}) {
  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
  const [completedResults, setCompletedResults] = useState<
    Array<{ name: string; shareUrl: string; token: string }>
  >([]);
  const [collectionResult, setCollectionResult] = useState<{
    name: string;
    shareUrl: string;
    token: string;
    fileCount: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [expiresIn, setExpiresIn] = useState("24h");
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");

  // Multipart sessions keyed by file index — enables resuming a partial upload
  // when a file fails and is retried (instead of restarting from zero).
  const mpSessionsRef = useRef<Record<number, MultipartSession>>({});

  // Speed tracking: keyed by file index, holds a rolling window of {bytes, time}
  // samples used to compute a smoothed bytes/sec estimate.
  const speedSamplesRef = useRef<
    Record<number, { bytes: number; time: number }[]>
  >({});

  // Regular file drop (react-dropzone handles files only)
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFileStates((prev) => [
      ...prev,
      ...acceptedFiles.map((f) => ({
        file: f,
        progress: 0,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 10 * 1024 * 1024 * 1024,
    noClick: false,
  });

  // Custom drag-over handler that also accepts folders
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Custom drop handler — detects folders via DataTransferItem API
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = Array.from(e.dataTransfer.items);
    const newStates: FileUploadState[] = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (!entry) continue;

      if (entry.isDirectory) {
        setZipping(true);
        try {
          toast.info(`Reading "${entry.name}"…`);
          const entries = await readDirectoryRecursive(
            entry as FileSystemDirectoryEntry,
          );
          if (entries.length === 0) {
            toast.error(`"${entry.name}" is empty.`);
            continue;
          }
          toast.info(`Zipping ${entries.length} files…`);
          const zipFile = await zipEntries(entry.name, entries);
          newStates.push({
            file: zipFile,
            progress: 0,
            status: "pending",
            isFolder: true,
          });
          toast.success(
            `"${entry.name}" zipped — ${formatBytes(zipFile.size)}`,
          );
        } catch (err) {
          console.error(err);
          toast.error(`Failed to read folder "${entry.name}".`);
        } finally {
          setZipping(false);
        }
      } else if (entry.isFile) {
        const file = await new Promise<File>((res) =>
          (entry as FileSystemFileEntry).file(res),
        );
        newStates.push({ file, progress: 0, status: "pending" });
      }
    }

    if (newStates.length > 0) {
      setFileStates((prev) => [...prev, ...newStates]);
    }
  }, []);

  // Folder picker via <input webkitdirectory>
  async function handleFolderPicker(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const folderName = files[0].webkitRelativePath.split("/")[0];
    setZipping(true);
    toast.info(`Zipping ${files.length} files from "${folderName}"…`);

    try {
      const entries = files.map((f) => ({
        file: f,
        path: f.webkitRelativePath.split("/").slice(1).join("/"),
      }));
      const zipFile = await zipEntries(folderName, entries);
      toast.success(`"${folderName}" zipped — ${formatBytes(zipFile.size)}`);
      setFileStates((prev) => [
        ...prev,
        { file: zipFile, progress: 0, status: "pending", isFolder: true },
      ]);
    } catch {
      toast.error("Failed to zip folder.");
    } finally {
      setZipping(false);
      e.target.value = "";
    }
  }

  function removeFile(index: number) {
    setFileStates((prev) => prev.filter((_, i) => i !== index));
  }

  // Upload a single part via XHR; returns the ETag from the response header.
  // Adds a stall watchdog so a hung connection fails fast (and can be retried)
  // instead of hanging forever. Includes a defensive guard against malformed URLs.
  function uploadPartOnce(
    chunk: Blob,
    url: string,
    onProgress: (loaded: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Defensive guard: never issue a malformed request (e.g. from a stale
      // multipart session or a server regression). An object coerced to a
      // string becomes "[object Object]" — exactly the broken URL seen in the
      // network log for large multipart uploads.
      if (typeof url !== "string" || !url) {
        reject(new Error("Invalid part upload URL."));
        return;
      }

      const xhr = new XMLHttpRequest();

      // If a part stalls with no progress (connection drops, preflight hangs),
      // abort it so the retry layer can pick it up instead of waiting forever.
      // 90s gives slow connections time to finish a 10 MB part without false aborts.
      const STALL_TIMEOUT_MS = 90 * 1000;
      let lastActivity = Date.now();
      const markActivity = () => {
        lastActivity = Date.now();
      };
      const watchdog = window.setInterval(() => {
        if (Date.now() - lastActivity > STALL_TIMEOUT_MS) {
          window.clearInterval(watchdog);
          xhr.abort();
          reject(new Error("Part upload stalled (no progress for 60s)."));
        }
      }, 5000);
      const clearWatchdog = () => window.clearInterval(watchdog);

      xhr.upload.addEventListener("progress", (e) => {
        markActivity();
        if (e.lengthComputable) onProgress(e.loaded);
      });
      xhr.addEventListener("loadstart", markActivity);

      xhr.addEventListener("load", () => {
        clearWatchdog();
        if (xhr.status >= 200 && xhr.status < 300) {
          // ETag must be exposed via "ExposeHeaders": ["ETag"] in your R2 CORS policy
          const etag =
            xhr.getResponseHeader("ETag") ||
            xhr.getResponseHeader("etag") ||
            "";
          if (!etag) {
            reject(
              new Error(
                "Part upload succeeded but ETag is missing. Add ETag to R2 bucket CORS ExposeHeaders.",
              ),
            );
          } else {
            resolve(etag);
          }
        } else {
          const err = new Error(`Part upload failed (HTTP ${xhr.status})`);
          (err as unknown as { status?: number }).status = xhr.status;
          reject(err);
        }
      });

      xhr.addEventListener("error", () => {
        clearWatchdog();
        reject(new Error("Part upload network error. Check your connection."));
      });
      xhr.addEventListener("abort", () => {
        clearWatchdog();
        reject(new Error("Part upload aborted."));
      });

      xhr.open("PUT", url);
      // Do NOT set Content-Type for part uploads — it is not in the signed headers
      xhr.send(chunk);
    });
  }

  // Retry wrapper — retries transient (network/timeout/5xx/408/429) failures with
  // exponential backoff + jitter. Permanent 4xx errors surface immediately.
  async function uploadPart(
    chunk: Blob,
    url: string,
    onProgress: (loaded: number) => void,
    partNumber: number,
  ): Promise<string> {
    const MAX_RETRIES = 6;
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Reset progress reporter on retries so the bar doesn't jump
        const etag = await uploadPartOnce(chunk, url, onProgress);
        return etag;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const status = (lastError as { status?: number }).status;
        // Don't retry permanent client errors (except 408 Request Timeout and
        // 429 Too Many Requests, which may succeed after backing off).
        if (
          typeof status === "number" &&
          status >= 400 &&
          status < 500 &&
          status !== 408 &&
          status !== 429
        ) {
          break;
        }

        if (attempt < MAX_RETRIES) {
          // Exponential back-off with jitter, capped ~26s: ~2s, 4s, 8s, 16s, 25s
          const base = Math.min(2000 * Math.pow(2, attempt - 1), 25000);
          const delay = base + Math.round(Math.random() * 1000);
          await new Promise((r) => setTimeout(r, delay));
          onProgress(0); // reset this part's progress before retry
          console.warn(
            `[UploadZone] Part ${partNumber} attempt ${attempt} failed, retrying… (${lastError.message})`,
          );
        }
      }
    }

    const err = new Error(
      `Part ${partNumber} failed after ${MAX_RETRIES} attempts: ${lastError.message}`,
    );
    (err as { status?: number }).status = (
      lastError as { status?: number }
    ).status;
    throw err;
  }

  async function uploadSingle(
    index: number,
  ): Promise<{ name: string; shareUrl: string; token: string } | void> {
    const state = fileStates[index];
    if (!state || state.status === "done") return;
    const file = state.file;

    const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB
    // 3 concurrent parts keeps R2 saturated without starving individual parts
    // on a slow connection. 8 was too many — parts 7 & 8 got almost no
    // bandwidth and hit the 60s stall watchdog, causing repeated aborts.
    const CONCURRENCY = 3; // parallel part uploads

    const updateState = (patch: Partial<FileUploadState>) =>
      setFileStates((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      );

    updateState({ status: "uploading", progress: 0 });

    try {
      // ── MULTIPART path (files > 50 MB) ───────────────────────────────────
      if (file.size > MULTIPART_THRESHOLD) {
        // Reuse an in-memory session, or a persisted one from a previous page
        // visit, so a retry/reload resumes from the last good part instead of
        // restarting from zero.
        let session =
          mpSessionsRef.current[index] ?? loadPersistedSession(file);

        if (
          !session ||
          session.chunkSize <= 0 ||
          Math.ceil(file.size / session.chunkSize) !== session.totalParts
        ) {
          const initiateRes = await fetch("/api/upload/multipart/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              original_name: file.name,
              file_size: file.size,
              mime_type: file.type || "application/octet-stream",
              expires_in: expiresIn,
              password: password || undefined,
              max_downloads: maxDownloads ? parseInt(maxDownloads) : undefined,
            }),
          });

          if (!initiateRes.ok) {
            const err = await initiateRes.json().catch(() => ({}));
            throw new Error(
              err.error || `Failed to initiate upload (${initiateRes.status})`,
            );
          }

          const data = await initiateRes.json();

          // The server returns `totalParts` and only the first batch of URLs.
          // We store them as a sparse map (partNumber → url) so we can add
          // more batches later without re-initiating.
          const initialUrls: Record<number, string> = {};
          (data.partUrls as string[]).forEach((url, i) => {
            initialUrls[i + 1] = url;
          });

          session = {
            token: data.token,
            shareUrl: data.shareUrl,
            storageKey: data.storageKey,
            uploadId: data.uploadId,
            chunkSize: data.chunkSize,
            totalParts: data.totalParts,
            partUrls: initialUrls,
            completed: {},
          };
          mpSessionsRef.current[index] = session;
        }

        if (!session) {
          throw new Error("Failed to initialize multipart upload session.");
        }
        persistSession(file, session);
        const active = session;
        const { token, shareUrl, storageKey, uploadId, chunkSize } = active;

        // Track per-part bytes uploaded for accurate overall progress
        const partProgress = new Array<number>(active.totalParts).fill(0);
        // Initialise speed sample window for this file
        speedSamplesRef.current[index] = [];
        const updateProgress = () => {
          const totalLoaded = partProgress.reduce((a, b) => a + b, 0);
          const progress = Math.round((totalLoaded / file.size) * 100);

          // Rolling 8-second window of (bytes, timestamp) samples → bytes/sec
          const now = Date.now();
          const samples = speedSamplesRef.current[index] ?? [];
          samples.push({ bytes: totalLoaded, time: now });
          // Drop samples older than 8 seconds
          const cutoff = now - 8000;
          while (samples.length > 1 && samples[0].time < cutoff)
            samples.shift();
          speedSamplesRef.current[index] = samples;

          let speed: number | undefined;
          let eta: number | undefined;
          if (samples.length >= 2) {
            const oldest = samples[0];
            const elapsed = (now - oldest.time) / 1000; // seconds
            const bytesDelta = totalLoaded - oldest.bytes;
            if (elapsed > 0 && bytesDelta > 0) {
              speed = bytesDelta / elapsed;
              const remaining = file.size - totalLoaded;
              eta = remaining / speed;
            }
          }

          updateState({ progress, speed, eta });
        };

        // Completed parts we already have from a previous attempt (resume).
        const completedParts: Array<{ partNumber: number; etag: string }> = [];
        const remainingParts: number[] = [];
        for (let p = 1; p <= active.totalParts; p++) {
          const etag = active.completed[p];
          if (etag) {
            partProgress[p - 1] = chunkSize;
            completedParts.push({ partNumber: p, etag });
          } else {
            remainingParts.push(p);
          }
        }
        updateProgress();

        // Helper: ensure presigned URLs for a range of parts are available in
        // the session, fetching a fresh batch from the server if any are missing.
        // This is the key fix for the "stalls at 46%" bug: instead of generating
        // all URLs at initiation (where later ones expire before use), we fetch
        // each batch just-in-time so they are always freshly signed.
        async function ensurePartUrls(
          firstPart: number,
          lastPart: number,
        ): Promise<void> {
          const missing = Array.from(
            { length: lastPart - firstPart + 1 },
            (_, i) => firstPart + i,
          ).filter((p) => !active.partUrls[p]);

          if (missing.length === 0) return;

          const fromPart = missing[0];
          const res = await fetch("/api/upload/multipart/part-urls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storageKey: active.storageKey,
              uploadId: active.uploadId,
              fromPart,
              totalParts: active.totalParts,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
              err.error || `Failed to fetch part URLs (HTTP ${res.status})`,
            );
          }

          const data = await res.json();
          (data.urls as string[]).forEach((url: string, i: number) => {
            active.partUrls[data.fromPart + i] = url;
          });
          // Persist the refreshed URLs so a reload can resume without re-fetching
          persistSession(file, active);
        }

        try {
          // Upload remaining parts with limited concurrency + per-part retry.
          // Fetch presigned URLs for each batch just before uploading it —
          // never more than CONCURRENCY parts ahead — so they are always fresh.
          const failedParts: number[] = [];

          for (let i = 0; i < remainingParts.length; i += CONCURRENCY) {
            const batch = remainingParts.slice(i, i + CONCURRENCY);

            // Fetch URLs for this batch (and the next one) before we start
            // uploading, so we don't block mid-batch waiting for a network round-trip.
            const prefetchEnd =
              remainingParts[
                Math.min(i + CONCURRENCY * 2 - 1, remainingParts.length - 1)
              ] ?? batch[batch.length - 1];
            await ensurePartUrls(batch[0], prefetchEnd);

            const results = await Promise.allSettled(
              batch.map(async (partNumber) => {
                const start = (partNumber - 1) * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);

                const url = active.partUrls[partNumber];
                if (!url) {
                  throw new Error(
                    `Presigned URL missing for part ${partNumber}`,
                  );
                }

                const etag = await uploadPart(
                  chunk,
                  url,
                  (loaded) => {
                    partProgress[partNumber - 1] = loaded;
                    updateProgress();
                  },
                  partNumber,
                );

                active.completed[partNumber] = etag;
                completedParts.push({ partNumber, etag });
                persistSession(file, active);
              }),
            );

            results.forEach((r, idx) => {
              if (r.status === "rejected") failedParts.push(batch[idx]);
            });
          }

          // Recovery pass: retry only the parts that failed, sequentially, so a
          // struggling connection isn't overloaded.
          if (failedParts.length > 0) {
            for (const partNumber of failedParts) {
              const start = (partNumber - 1) * chunkSize;
              const end = Math.min(start + chunkSize, file.size);
              const chunk = file.slice(start, end);

              // Always fetch a fresh URL for a retry — the old one may be stale.
              const refreshRes = await fetch(
                "/api/upload/multipart/part-urls",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    storageKey: active.storageKey,
                    uploadId: active.uploadId,
                    fromPart: partNumber,
                    totalParts: active.totalParts,
                  }),
                },
              );
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                active.partUrls[partNumber] = refreshData.urls[0];
              }

              const url = active.partUrls[partNumber];
              if (!url) {
                throw new Error(
                  `Could not obtain a presigned URL for part ${partNumber}`,
                );
              }

              const etag = await uploadPart(
                chunk,
                url,
                (loaded) => {
                  partProgress[partNumber - 1] = loaded;
                  updateProgress();
                },
                partNumber,
              );

              active.completed[partNumber] = etag;
              completedParts.push({ partNumber, etag });
              persistSession(file, active);
            }
          }
        } catch (partErr) {
          // Keep the session (with completed parts) so a retry can resume instead
          // of restarting. The R2 cleanup job eventually removes orphaned sessions.
          throw partErr;
        }

        // Sort parts by partNumber before completing
        completedParts.sort((a, b) => a.partNumber - b.partNumber);

        // Ensure every part made it — otherwise the multipart cannot be completed.
        const expectedParts = new Set(
          Array.from({ length: active.totalParts }, (_, i) => i + 1),
        );
        const haveParts = new Set(completedParts.map((p) => p.partNumber));
        if ([...expectedParts].some((p) => !haveParts.has(p))) {
          throw new Error(
            "Some parts failed repeatedly. The upload can't complete, but your " +
              "progress is saved — press Retry to resume from the last good part.",
          );
        }

        const completeRes = await fetch("/api/upload/multipart/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            storageKey,
            uploadId,
            parts: completedParts,
          }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to complete multipart upload.");
        }

        // Upload finished — drop the stored session (memory + localStorage).
        delete mpSessionsRef.current[index];
        delete speedSamplesRef.current[index];
        clearPersistedSession(file);

        if (defaultCollectionId) {
          await fetch(`/api/collections/${defaultCollectionId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, action: "add" }),
          });
        }

        updateState({
          status: "done",
          progress: 100,
          result: { token, shareUrl, name: file.name },
        });
        onUploadSuccess?.(token, shareUrl);
        return { name: file.name, shareUrl, token };
      }

      // ── SINGLE PUT path (files ≤ 50 MB) ──────────────────────────────────
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_name: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          expires_in: expiresIn,
          password: password || undefined,
          max_downloads: maxDownloads ? parseInt(maxDownloads) : undefined,
        }),
      });

      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => ({}));
        throw new Error(
          err.error || `Failed to get upload URL (${presignedRes.status})`,
        );
      }

      const { token, presignedUrl, shareUrl, mimeType } =
        await presignedRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        // If a request stalls with no progress (e.g. the R2 connection drops or a
        // CORS preflight hangs), the promise below would never settle and the UI
        // would stay stuck on "Uploading… 0%". The watchdog aborts it instead.
        const STALL_TIMEOUT_MS = 45000;
        let lastActivity = Date.now();
        const markActivity = () => {
          lastActivity = Date.now();
        };
        const watchdog = window.setInterval(() => {
          if (Date.now() - lastActivity > STALL_TIMEOUT_MS) {
            window.clearInterval(watchdog);
            xhr.abort();
            reject(
              new Error(
                "Upload stalled (no progress for 45s). Check your connection and R2 CORS.",
              ),
            );
          }
        }, 5000);
        const clearWatchdog = () => window.clearInterval(watchdog);

        xhr.upload.addEventListener("progress", (e) => {
          markActivity();
          if (e.lengthComputable)
            updateState({ progress: Math.round((e.loaded / e.total) * 100) });
        });
        xhr.addEventListener("loadstart", markActivity);
        xhr.addEventListener("load", () => {
          clearWatchdog();
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Storage upload failed (${xhr.status}). Check R2 CORS settings.`,
              ),
            );
          }
        });
        xhr.addEventListener("error", () => {
          clearWatchdog();
          reject(
            new Error(
              "Storage upload network error. Ensure Cloudflare R2 CORS allows this domain.",
            ),
          );
        });
        xhr.addEventListener("abort", () => {
          clearWatchdog();
          reject(new Error("Upload aborted."));
        });
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader(
          "Content-Type",
          mimeType || file.type || "application/octet-stream",
        );
        xhr.send(file);
      });

      await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          console.error("[UploadZone] Confirm failed:", err);
        }
      });

      if (defaultCollectionId) {
        await fetch(`/api/collections/${defaultCollectionId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: "add" }),
        });
      }

      updateState({
        status: "done",
        progress: 100,
        result: { token, shareUrl, name: file.name },
      });
      onUploadSuccess?.(token, shareUrl);
      return { name: file.name, shareUrl, token };
    } catch (err) {
      updateState({
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed.",
      });
      throw err;
    }
  }

  async function handleUploadAll() {
    if (fileStates.length === 0) return;
    setUploading(true);
    onUploadingChange?.(true);

    try {
      const pendingIndices = fileStates
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.status === "pending" || s.status === "error")
        .map(({ i }) => i);

      const CONCURRENCY = 3;
      let successCount = 0;
      let errorCount = 0;
      const newResults: Array<{
        name: string;
        shareUrl: string;
        token: string;
      }> = [];

      for (let i = 0; i < pendingIndices.length; i += CONCURRENCY) {
        const batch = pendingIndices.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((idx) => uploadSingle(idx)),
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            successCount++;
            newResults.push(r.value);
          } else {
            errorCount++;
          }
        }
      }

      if (successCount > 0)
        toast.success(
          `${successCount} item${successCount > 1 ? "s" : ""} uploaded!`,
        );
      if (errorCount > 0)
        toast.error(`${errorCount} item${errorCount > 1 ? "s" : ""} failed.`);

      // If multiple files uploaded successfully, auto-create or reuse today's collection
      if (newResults.length > 1) {
        try {
          const todayLabel = new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          });

          // Resolve auth state client-side first so guests never hit the
          // protected /api/collections endpoint (avoids a wasted, slow 401
          // round-trip and keeps the DevTools network log clean).
          const { data: sessionData } =
            await getSupabaseBrowser().auth.getSession();
          const isAuthenticated = Boolean(sessionData.session?.user);

          const listRes = isAuthenticated
            ? await fetch("/api/collections")
            : null;

          if (listRes?.ok) {
            // Logged-in user
            const { collections: existingCols } = await listRes.json();

            // Find a collection created today (same calendar day)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayCol = (
              existingCols as Array<{
                id: string;
                name: string;
                share_token: string;
                created_at: string;
              }>
            ).find((c) => new Date(c.created_at) >= todayStart);

            let collection: { id: string; name: string; share_token: string };

            if (todayCol) {
              // Reuse today's collection — just add files to it
              collection = todayCol;
            } else {
              // Create a new collection for today
              const colName = `${newResults.length} files – ${todayLabel}`;
              const colRes = await fetch("/api/collections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: colName }),
              });
              if (!colRes.ok) throw new Error("Failed to create collection");
              const data = await colRes.json();
              collection = data.collection;
            }

            // Link new files to the collection
            await Promise.allSettled(
              newResults.map((r) =>
                fetch(`/api/collections/${collection.id}/files`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token: r.token, action: "add" }),
                }),
              ),
            );

            const shareUrl = `${window.location.origin}/c/${collection.share_token}`;
            setCollectionResult({
              name: collection.name,
              shareUrl,
              token: collection.share_token,
              fileCount: newResults.length,
            });
          } else {
            // Guest user: use the guest collection endpoint
            const colName = `${newResults.length} files – ${todayLabel}`;
            const guestRes = await fetch("/api/collections/guest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: colName,
                tokens: newResults.map((r) => r.token),
              }),
            });

            if (guestRes.ok) {
              const { collection } = await guestRes.json();
              const shareUrl = `${window.location.origin}/c/${collection.share_token}`;
              setCollectionResult({
                name: colName,
                shareUrl,
                token: collection.share_token,
                fileCount: newResults.length,
              });
            } else {
              const errText = await guestRes.text();
              console.warn(
                "[UploadZone] Guest collection API failed:",
                guestRes.status,
                errText,
              );
              setCompletedResults(newResults);
            }
          }
        } catch (err) {
          console.warn("[UploadZone] Collection error:", err);
          setCompletedResults(newResults);
        }
      } else {
        // Single file — just set completed results
        setCompletedResults(newResults);
      }
    } catch (err) {
      console.error("[UploadZone] handleUploadAll failed:", err);
      toast.error("Unexpected upload error. Please try again.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  function handleReset() {
    setFileStates([]);
    setCompletedResults([]);
    setCollectionResult(null);
    setPassword("");
    setMaxDownloads("");
    setExpiresIn("24h");
    // Let the parent know uploading is no longer in progress so the dialog
    // can be closed/dismissed (fixes the stuck "Upload in progress" state
    // that blocked the X button after clearing a finished upload).
    onUploadingChange?.(false);
    setUploading(false);

    // Best-effort abort any dangling multipart sessions to free R2 storage.
    for (const s of Object.values(mpSessionsRef.current)) {
      fetch("/api/upload/multipart/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey: s.storageKey,
          uploadId: s.uploadId,
        }),
      }).catch(() => {});
    }
    mpSessionsRef.current = {};
    clearAllPersistedSessions();
  }

  const hasPending = fileStates.some(
    (s) => s.status === "pending" || s.status === "error",
  );
  const singleResult =
    fileStates.length === 1 && fileStates[0].status === "done"
      ? fileStates[0].result
      : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-xl space-y-3 min-w-0">
      {/* Drop zone */}
      {!singleResult && (
        <div
          {...getRootProps()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 select-none ${
            isDragActive || zipping
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/40"
          }`}
        >
          <input {...getInputProps()} />

          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
              isDragActive || zipping
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {zipping ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <UploadCloud className="h-7 w-7" />
            )}
          </div>

          <p className="mt-4 text-base font-semibold">
            {zipping
              ? "Zipping folder…"
              : isDragActive
                ? "Drop files or folders here"
                : "Drag & drop files or folders"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or{" "}
            <span className="text-primary font-medium cursor-pointer">
              click to browse files
            </span>
          </p>

          {/* Folder picker */}
          <div
            className="mt-4 flex justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              <FolderOpen className="h-3.5 w-3.5" />
              Select a folder
              <input
                type="file"
                className="hidden"
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory=""
                multiple
                onChange={handleFolderPicker}
              />
            </label>
          </div>
        </div>
      )}

      {/* File / folder list */}
      {fileStates.length > 0 && (
        <div className="space-y-2">
          {fileStates.map((state, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {state.isFolder ? (
                    <FolderOpen className="h-4 w-4 text-primary" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {state.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {state.isFolder ? "Folder (zipped) · " : ""}
                    {formatBytes(state.file.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {state.status === "done" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {state.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  {state.status === "uploading" && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {(state.status === "pending" || state.status === "error") &&
                    !uploading && (
                      <button
                        onClick={() => removeFile(i)}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                </div>
              </div>
              {state.status === "uploading" && (
                <div className="px-4 pb-3">
                  <Progress value={state.progress} className="h-1.5" />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {state.speed !== undefined
                        ? `${formatBytes(state.speed)}/s`
                        : ""}
                    </span>
                    <span>
                      {state.eta !== undefined && state.speed !== undefined
                        ? `~${formatEta(state.eta)} left · `
                        : ""}
                      {state.progress}%
                    </span>
                  </div>
                </div>
              )}
              {state.status === "error" && (
                <p className="px-4 pb-3 text-xs text-destructive">
                  {state.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single file done — show share card */}
      {singleResult && (
        <ShareCard
          shareUrl={singleResult.shareUrl}
          token={singleResult.token}
        />
      )}

      {/* Multi-file done — single collection QR */}
      {collectionResult && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {collectionResult.fileCount} files uploaded — one link for all:
          </div>
          <ShareCard
            shareUrl={collectionResult.shareUrl}
            token={collectionResult.token}
          />
        </div>
      )}

      {/* Fallback: multi done but no collection (guest user) */}
      {completedResults.length > 1 && !collectionResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            All {completedResults.length} items uploaded — share links below:
          </div>
          {completedResults.map((r, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground px-1 mb-1 truncate">
                {r.name}
              </p>
              <ShareCard shareUrl={r.shareUrl} token={r.token} />
            </div>
          ))}
        </div>
      )}

      {/* Actions bar */}
      {fileStates.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2">
            {hasPending && (
              <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
                <DialogTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Settings2 className="h-4 w-4" />
                    Options
                    {/* Show active option indicators */}
                    {(expiresIn !== "24h" || password || maxDownloads) && (
                      <span className="flex items-center gap-1 ml-0.5">
                        {expiresIn !== "24h" && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                            {
                              EXPIRY_OPTIONS.find((o) => o.value === expiresIn)
                                ?.label
                            }
                          </span>
                        )}
                        {password && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                            🔒
                          </span>
                        )}
                        {maxDownloads && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                            ↓{maxDownloads}
                          </span>
                        )}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Upload Options</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 pt-1">
                    <div>
                      <label className="text-sm font-medium">Expires in</label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {EXPIRY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setExpiresIn(opt.value)}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${expiresIn === opt.value ? "border-primary bg-primary/5 font-medium text-primary" : "border-border hover:bg-muted"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Password{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Input
                        type="password"
                        placeholder="Leave empty for no password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Max downloads{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Input
                        type="number"
                        placeholder="Unlimited"
                        value={maxDownloads}
                        onChange={(e) => setMaxDownloads(e.target.value)}
                        min={1}
                        max={1000}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  {/* Active options summary */}
                  <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">
                      Active settings:
                    </p>
                    <p>
                      ⏱ Expires:{" "}
                      <span className="font-medium text-foreground">
                        {
                          EXPIRY_OPTIONS.find((o) => o.value === expiresIn)
                            ?.label
                        }
                      </span>
                    </p>
                    <p>
                      🔒 Password:{" "}
                      <span className="font-medium text-foreground">
                        {password ? "Set" : "None"}
                      </span>
                    </p>
                    <p>
                      ⬇️ Max downloads:{" "}
                      <span className="font-medium text-foreground">
                        {maxDownloads || "Unlimited"}
                      </span>
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setOptionsOpen(false)}
                  >
                    Apply Settings
                  </Button>
                </DialogContent>
              </Dialog>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>

          {hasPending && (
            <Button
              onClick={handleUploadAll}
              disabled={uploading || zipping}
              size="sm"
              className="gap-1.5 w-full sm:w-auto"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {uploading
                ? "Uploading…"
                : `Upload ${fileStates.filter((s) => s.status === "pending" || s.status === "error").length} item${fileStates.filter((s) => s.status === "pending" || s.status === "error").length > 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
