"use client";

import {
  FileImage,
  FileText,
  FileAudio,
  FileVideo,
  File as FileIcon,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilePreviewProps {
  mimeType: string;
  previewUrl: string | null;
  originalName: string;
  fileSize: string;
  onDownload?: () => void;
}

export default function FilePreview({
  mimeType,
  previewUrl,
  originalName,
  fileSize,
  onDownload,
}: FilePreviewProps) {
  const handlePreviewDownload = () => {
    if (previewUrl) {
      const link = document.createElement("a");
      link.href = previewUrl;
      link.download = originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (mimeType.startsWith("image/") && previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={originalName}
            loading="lazy"
            className="max-h-[60vh] w-auto rounded-lg border object-contain"
          />
          {/* Overlay download button on hover */}
          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              onClick={handlePreviewDownload}
              size="sm"
              className="gap-2"
              variant="secondary"
            >
              <Download className="h-4 w-4" />
              Download Preview
            </Button>
          </div>
        </div>
        {onDownload && (
          <Button onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download Full File
          </Button>
        )}
      </div>
    );
  }

  if (mimeType === "application/pdf" && previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <iframe
          src={previewUrl}
          title={originalName}
          className="h-[60vh] w-full rounded-lg border"
        />
        <div className="flex gap-2 w-full">
          <Button
            onClick={handlePreviewDownload}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Download className="h-4 w-4" />
            Download Preview
          </Button>
          {onDownload && (
            <Button onClick={onDownload} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Download Full File
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (mimeType.startsWith("video/") && previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <video
          controls
          className="max-h-[60vh] w-full rounded-lg border"
          src={previewUrl}
        >
          Your browser does not support the video tag.
        </video>
        <div className="flex gap-2 w-full">
          <Button
            onClick={handlePreviewDownload}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Download className="h-4 w-4" />
            Download Preview
          </Button>
          {onDownload && (
            <Button onClick={onDownload} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Download Full File
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (mimeType.startsWith("audio/") && previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <audio controls className="w-full" src={previewUrl}>
          Your browser does not support the audio tag.
        </audio>
        <div className="flex gap-2 w-full">
          <Button
            onClick={handlePreviewDownload}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Download className="h-4 w-4" />
            Download Preview
          </Button>
          {onDownload && (
            <Button onClick={onDownload} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Download Full File
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Fallback icon
  const Icon = mimeType.startsWith("image/")
    ? FileImage
    : mimeType === "application/pdf"
      ? FileText
      : mimeType.startsWith("audio/")
        ? FileAudio
        : mimeType.startsWith("video/")
          ? FileVideo
          : FileIcon;

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-12">
      <Icon className="h-20 w-20 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">{originalName}</p>
        <p className="text-sm text-muted-foreground">{fileSize}</p>
      </div>
    </div>
  );
}
