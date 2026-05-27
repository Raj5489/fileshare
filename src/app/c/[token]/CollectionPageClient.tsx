"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FolderOpen,
  File as FileIcon,
  Image,
  FileText,
  Film,
  Music,
  Archive,
  Download,
  Copy,
  Check,
  Clock,
  PackageOpen,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";
import { useState } from "react";

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

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.startsWith("audio/")) return Music;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z")
  )
    return Archive;
  return FileIcon;
}

function getFileCategory(mimeType: string) {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z") ||
    mimeType.includes("rar")
  )
    return "Archive";
  if (mimeType.startsWith("text/")) return "Text";
  return "File";
}

export default function CollectionPageClient({
  data,
}: {
  data: CollectionData;
}) {
  const { collection, files } = data;
  const [copied, setCopied] = useState(false);

  const totalSize = files.reduce((sum, f) => sum + f.file_size, 0);
  const activeFiles = files.filter((f) => !f.is_expired);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-full max-w-2xl space-y-5">
      {/* Hero header */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Top accent bar */}
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

          {/* Instructions */}
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-primary font-medium mb-1">
              How to download
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Click{" "}
              <span className="font-medium text-foreground">Download</span> on
              any file below to save it to your device. Each file opens on its
              own page where you can preview and download it.
            </p>
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
                  {/* Number */}
                  <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">
                    {i + 1}
                  </span>

                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Info */}
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

                  {/* Action */}
                  {file.is_expired ? (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Expired
                    </Badge>
                  ) : (
                    <Link href={`/f/${file.share_token}`} target="_blank">
                      <Button size="sm" className="gap-1.5 shrink-0 h-8">
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer hint */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          🔒 Files are securely stored and will expire as shown above. Shared
          via <span className="font-medium text-foreground">FileShare</span>
        </p>
      </div>
    </div>
  );
}
