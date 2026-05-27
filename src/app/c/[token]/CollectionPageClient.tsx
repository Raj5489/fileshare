"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FolderOpen,
  Download,
  Copy,
  Check,
  Clock,
  PackageOpen,
  Loader2,
} from "lucide-react";
import { formatBytes, getFileIcon, getFileCategory } from "@/lib/utils";
import { useState, useEffect } from "react";

interface FileEntry {
  share_token: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_size_formatted: string;
  download_count: number;
  expires_at: string | null;
  is_expired: boolean;
}

interface CollectionData {
  collection: {
    name: string;
    share_token: string;
    created_at: string;
    file_count: number;
  };
  files: FileEntry[];
}

// ─── File Download Modal ────────────────────────────────────────────────────

function FileDownloadModal({
  file,
  open,
  onClose,
}: {
  file: FileEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Fetch preview URL whenever this modal opens for an image
  useEffect(() => {
    if (!open || !file) return;
    if (!file.mime_type.startsWith("image/")) return;

    let cancelled = false;
    setPreviewUrl(null);
    setPreviewLoaded(false);
    setPreviewError(false);

    fetch(`/api/files/${file.share_token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data.preview_url) {
            setPreviewUrl(data.preview_url);
          } else {
            setPreviewError(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, file]);

  async function handleDownload() {
    if (!file) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/download/${file.share_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = file.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Download started!");
      } else {
        toast.error(data.error || "Download failed.");
      }
    } catch {
      toast.error("Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  if (!file) return null;

  const Icon = getFileIcon(file.mime_type);
  const category = getFileCategory(file.mime_type);
  const isImage = file.mime_type.startsWith("image/");

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 pr-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <span className="truncate text-base">{file.original_name}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Image preview */}
        {isImage && (
          <div className="flex justify-center items-center rounded-lg overflow-hidden bg-muted/40 border min-h-[140px]">
            {previewError ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Image className="h-10 w-10 opacity-30" />
                <span className="text-xs">Preview unavailable</span>
              </div>
            ) : previewUrl ? (
              <>
                {!previewLoaded && (
                  <div className="absolute flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin opacity-40" />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={file.original_name}
                  onLoad={() => setPreviewLoaded(true)}
                  onError={() => setPreviewError(true)}
                  className={`max-h-64 w-auto object-contain transition-opacity duration-300 ${
                    previewLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin opacity-40" />
                <span className="text-xs">Loading preview…</span>
              </div>
            )}
          </div>
        )}

        {/* File meta */}
        <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/20 text-center">
          <div className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-sm font-semibold mt-0.5">{category}</p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Size</p>
            <p className="text-sm font-semibold mt-0.5">
              {file.file_size_formatted}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Expires</p>
            <p className="text-sm font-semibold mt-0.5">
              {file.expires_at
                ? new Date(file.expires_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Download button */}
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full gap-2"
          size="lg"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Starting download…" : "Download File"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CollectionPageClient({
  data,
}: {
  data: CollectionData;
}) {
  const { collection, files } = data;
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const totalSize = files.reduce((sum, f) => sum + f.file_size, 0);
  const activeFiles = files.filter((f) => !f.is_expired);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function openFileModal(file: FileEntry) {
    setSelectedFile(file);
    setModalOpen(true);
  }

  return (
    <div className="w-full max-w-2xl space-y-5">
      {/* Hero header */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PackageOpen className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate">
                {collection.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Someone shared{" "}
                <span className="font-medium text-foreground">
                  {collection.file_count} file
                  {collection.file_count !== 1 ? "s" : ""}
                </span>{" "}
                with you
                {totalSize > 0 && <> · {formatBytes(totalSize)} total</>}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-center">
              <p className="text-lg font-bold">{collection.file_count}</p>
              <p className="text-xs text-muted-foreground">Files</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-center">
              <p className="text-lg font-bold">{formatBytes(totalSize)}</p>
              <p className="text-xs text-muted-foreground">Total size</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-center">
              <p className="text-lg font-bold">{activeFiles.length}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* File list */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
          <p className="text-sm font-medium">Files in this share</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 h-7 text-xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <FolderOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">This collection is empty.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {files.map((file, i) => {
              const Icon = getFileIcon(file.mime_type);
              const category = getFileCategory(file.mime_type);
              return (
                <li
                  key={file.share_token}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">
                    {i + 1}
                  </span>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {file.original_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {category}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {file.file_size_formatted}
                      </span>
                      {file.expires_at && !file.is_expired && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            ·
                          </span>
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Expires{" "}
                            {new Date(file.expires_at).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {file.is_expired ? (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Expired
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5 shrink-0 h-8"
                      onClick={() => openFileModal(file)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          🔒 Files are securely stored and will expire as shown above. Shared
          via <span className="font-medium text-foreground">FileShare</span>
        </p>
      </div>

      {/* Inline download modal */}
      <FileDownloadModal
        file={selectedFile}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
