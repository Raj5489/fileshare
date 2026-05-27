"use client";

import { useState, useCallback } from "react";
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

  async function uploadSingle(
    index: number,
  ): Promise<{ name: string; shareUrl: string; token: string } | void> {
    const state = fileStates[index];
    if (!state || state.status === "done") return;
    const file = state.file;

    const updateState = (patch: Partial<FileUploadState>) =>
      setFileStates((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      );

    updateState({ status: "uploading", progress: 0 });

    try {
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
        const err = await presignedRes.json();
        throw new Error(err.error || "Failed to get upload URL.");
      }

      const { token, presignedUrl, shareUrl } = await presignedRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable)
            updateState({ progress: Math.round((e.loaded / e.total) * 100) });
        });
        xhr.addEventListener("load", () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error("Upload failed.")),
        );
        xhr.addEventListener("error", () =>
          reject(new Error("Network error.")),
        );
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
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

    const pendingIndices = fileStates
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status === "pending" || s.status === "error")
      .map(({ i }) => i);

    const CONCURRENCY = 3;
    let successCount = 0;
    let errorCount = 0;
    const newResults: Array<{ name: string; shareUrl: string; token: string }> =
      [];

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

        // Try authenticated flow first
        const listRes = await fetch("/api/collections");

        if (listRes.ok) {
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
    setUploading(false);
    onUploadingChange?.(false);
  }

  function handleReset() {
    setFileStates([]);
    setCompletedResults([]);
    setCollectionResult(null);
    setPassword("");
    setMaxDownloads("");
    setExpiresIn("24h");
  }

  const allDone =
    fileStates.length > 0 && fileStates.every((s) => s.status === "done");
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
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {state.progress}%
                  </p>
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
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
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
              className="gap-1.5"
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
