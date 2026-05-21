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
  ExternalLink,
  Copy,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";

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

export default function CollectionPageClient({
  data,
}: {
  data: CollectionData;
}) {
  const { collection, files } = data;

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Collection link copied!");
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {collection.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {collection.file_count} file
                {collection.file_count !== 1 ? "s" : ""} · Created{" "}
                {formatDate(collection.created_at)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 shrink-0"
          >
            <Copy className="h-4 w-4" />
            Copy Link
          </Button>
        </div>
      </div>

      {/* File list */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <FolderOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">This collection is empty.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {files.map((file) => {
              const Icon = getFileIcon(file.mime_type);
              return (
                <li
                  key={file.share_token}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {file.original_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {file.file_size_formatted}
                      {file.expires_at && !file.is_expired && (
                        <> · Expires {formatDate(file.expires_at)}</>
                      )}
                    </p>
                  </div>
                  {file.is_expired ? (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Expired
                    </Badge>
                  ) : (
                    <Link href={`/f/${file.share_token}`} target="_blank">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Button>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Shared via <span className="font-medium">FileShare</span>
      </p>
    </div>
  );
}
