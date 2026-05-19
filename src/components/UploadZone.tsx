"use client";

import { useState, useCallback } from "react";
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
import { UploadCloud, File, X, Settings, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import ShareCard from "./ShareCard";

interface UploadResult {
  token: string;
  shareUrl: string;
}

export default function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [expiresIn, setExpiresIn] = useState("24h");
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 10 * 1024 * 1024 * 1024,
  });

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);

    try {
      // 1. Request presigned URL
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

      // 2. Upload directly to R2 with XMLHttpRequest for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Upload failed. Please try again."));
          }
        });

        xhr.addEventListener("error", () =>
          reject(new Error("Network error during upload."))
        );

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      // 3. Confirm upload
      await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      setResult({ token, shareUrl });
      toast.success("File uploaded successfully!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setProgress(0);
    setPassword("");
    setMaxDownloads("");
    setExpiresIn("24h");
  }

  if (result) {
    return (
      <div className="w-full max-w-xl">
        <ShareCard shareUrl={result.shareUrl} token={result.token} />
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={handleReset}>
            Upload Another File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-4">
      {!file ? (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-200 ${
            isDragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/50"
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-16 w-16 text-muted-foreground/60" />
          <p className="mt-6 text-lg font-semibold">
            {isDragActive ? "Drop the file here" : "Drag & drop a file here"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            or click to browse — Max 500 MB
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <File className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatBytes(file.size)}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {uploading && (
            <div className="mt-5">
              <Progress value={progress} className="h-2" />
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {progress}% uploaded
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
              <DialogTrigger>
                <Button variant="outline" size="sm" disabled={uploading}>
                  <Settings className="mr-1.5 h-4 w-4" />
                  Options
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Options</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium">Expires In</label>
                    <select
                      className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none"
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                    >
                      <option value="1h">1 hour</option>
                      <option value="24h">24 hours</option>
                      <option value="7d">7 days</option>
                      <option value="30d">30 days</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Password Protection (optional)
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
                      Max Downloads (optional)
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
              </DialogContent>
            </Dialog>

            <Button onClick={handleUpload} disabled={uploading} size="sm">
              {uploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-1.5 h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
