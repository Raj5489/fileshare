"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import FilePreview from "@/components/FilePreview";
import PasswordGate from "@/components/PasswordGate";

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

interface SharePageClientProps {
  metadata: Metadata;
}

export default function SharePageClient({ metadata }: SharePageClientProps) {
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
      } else {
        setPwError(data.error || "Incorrect password.");
      }
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
        body: JSON.stringify({ password: unlocked && password ? password : undefined }),
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

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-8">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">
                  {metadata.original_name}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {metadata.file_size_formatted} · {metadata.download_count} downloads
                  {metadata.expires_at && (
                    <> · Expires {new Date(metadata.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                  )}
                </p>
              </div>
              <Button onClick={handleDownload} disabled={downloading} className="shrink-0">
                {downloading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Download
              </Button>
            </div>

            <FilePreview
              mimeType={metadata.mime_type}
              previewUrl={metadata.preview_url}
              originalName={metadata.original_name}
              fileSize={metadata.file_size_formatted}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
