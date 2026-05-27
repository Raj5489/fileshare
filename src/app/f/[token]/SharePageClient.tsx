"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Loader2, Eye, Calendar, Shield } from "lucide-react";
import FilePreview from "@/components/FilePreview";
import PasswordGate from "@/components/PasswordGate";
import {
  formatDate,
  formatBytes,
  getFileIcon,
  getFileCategory,
} from "@/lib/utils";

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
      <div className="rounded-2xl border bg-card shadow-lg shadow-black/5 overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-violet-500/60" />

        {/* File hero */}
        <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm shadow-primary/10 ring-1 ring-primary/10">
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-lg font-bold leading-tight"
              title={metadata.original_name}
            >
              {metadata.original_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
                {category}
              </span>
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="sm"
            className="shrink-0 gap-2 btn-shimmer text-white shadow-md shadow-primary/20"
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
        <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
          <div className="flex flex-col items-center gap-0.5 px-4 py-3.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Size
            </span>
            <span className="text-sm font-bold">
              {metadata.file_size_formatted}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-4 py-3.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Downloads
            </span>
            <span className="text-sm font-bold">{metadata.download_count}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-4 py-3.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Expires
            </span>
            <span className="text-sm font-bold">
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
          <div className="p-4 border-b bg-muted/5">
            <FilePreview
              mimeType={metadata.mime_type}
              previewUrl={metadata.preview_url}
              originalName={metadata.original_name}
              fileSize={metadata.file_size_formatted}
              onDownload={handleDownload}
            />
          </div>
        )}

        {/* No preview placeholder */}
        {!hasPreview && (
          <div className="flex flex-col items-center gap-4 px-6 py-14">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-muted text-muted-foreground shadow-inner">
                <Icon className="h-11 w-11" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Download className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold">{metadata.original_name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {metadata.file_size_formatted} · {category}
              </p>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2 mt-1 btn-shimmer text-white shadow-md shadow-primary/20 px-8"
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
        <div className="flex items-center justify-between px-6 py-3 bg-muted/20 text-xs text-muted-foreground border-t">
          <span>Shared {formatDate(metadata.created_at)}</span>
          {metadata.has_password && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Shield className="h-3 w-3" />
              Password protected
            </span>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Shared via{" "}
        <span className="font-semibold gradient-text">FileShare</span>
      </p>
    </div>
  );
}
