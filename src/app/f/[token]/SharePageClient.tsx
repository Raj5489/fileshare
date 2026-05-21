"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Eye,
  Calendar,
  Shield,
  FileIcon,
  Image,
  FileText,
  Film,
  Music,
  Archive,
} from "lucide-react";
import FilePreview from "@/components/FilePreview";
import PasswordGate from "@/components/PasswordGate";
import { formatDate, formatBytes } from "@/lib/utils";

interface Metadata {
  token: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_size_formatted: string;
  download_count: number;
  expires_at: string | null;
  has_password: boolean;
  preview_url: string | null;
  created_at: string;
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

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF Document";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z") ||
    mimeType.includes("rar")
  )
    return "Archive";
  if (mimeType.startsWith("text/")) return "Text File";
  if (mimeType.includes("word") || mimeType.includes("document"))
    return "Document";
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return "Spreadsheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "Presentation";
  return "File";
}

export default function SharePageClient({ metadata }: { metadata: Metadata }) {
  const [unlocked, setUnlocked] = useState(!metadata.has_password);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleUnlock(pw: string) {
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch(`/api/download/${metadata.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, verify_only: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassword(pw);
        setUnlocked(true);
      } else setPwError(data.error || "Incorrect password.");
    } catch {
      setPwError("Something went wrong.");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/download/${metadata.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: unlocked && password ? password : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.download_url) {
        window.location.href = data.download_url;
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

  if (!unlocked) {
    return (
      <div className="w-full max-w-md">
        <PasswordGate
          onUnlock={handleUnlock}
          error={pwError}
          loading={pwLoading}
        />
      </div>
    );
  }

  const Icon = getFileIcon(metadata.mime_type);
  const category = getFileCategory(metadata.mime_type);
  const hasPreview = !!metadata.preview_url;

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Main card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* File hero */}
        <div className="flex items-center gap-4 px-6 py-5 border-b">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-lg font-semibold leading-tight"
              title={metadata.original_name}
            >
              {metadata.original_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{category}</p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="sm"
            className="shrink-0 gap-2"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? "Starting…" : "Download"}
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x border-b bg-muted/20">
          <div className="flex flex-col items-center gap-0.5 px-4 py-3">
            <span className="text-xs text-muted-foreground">Size</span>
            <span className="text-sm font-semibold">
              {metadata.file_size_formatted}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-4 py-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Downloads
            </span>
            <span className="text-sm font-semibold">
              {metadata.download_count}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-4 py-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Expires
            </span>
            <span className="text-sm font-semibold">
              {metadata.expires_at
                ? new Date(metadata.expires_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                : "Never"}
            </span>
          </div>
        </div>

        {/* Preview */}
        {hasPreview && (
          <div className="p-4 border-b">
            <FilePreview
              mimeType={metadata.mime_type}
              previewUrl={metadata.preview_url}
              originalName={metadata.original_name}
              fileSize={metadata.file_size_formatted}
            />
          </div>
        )}

        {/* No preview — show a nicer placeholder with download CTA */}
        {!hasPreview && (
          <div className="flex flex-col items-center gap-4 px-6 py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Icon className="h-10 w-10" />
            </div>
            <div className="text-center">
              <p className="font-medium">{metadata.original_name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {metadata.file_size_formatted} · {category}
              </p>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2 mt-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "Starting…" : "Download File"}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-muted/20 text-xs text-muted-foreground">
          <span>Shared {formatDate(metadata.created_at)}</span>
          {metadata.has_password && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Password protected
            </span>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Shared via{" "}
        <span className="font-medium text-foreground">FileShare</span>
      </p>
    </div>
  );
}
