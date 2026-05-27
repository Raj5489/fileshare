"use client";

import {
  FileImage,
  FileText,
  FileAudio,
  FileVideo,
  File as FileIcon,
} from "lucide-react";

interface FilePreviewProps {
  mimeType: string;
  previewUrl: string | null;
  originalName: string;
  fileSize: string;
}

export default function FilePreview({
  mimeType,
  previewUrl,
  originalName,
  fileSize,
}: FilePreviewProps) {
  if (mimeType.startsWith("image/") && previewUrl) {
    return (
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={originalName}
          loading="lazy"
          className="max-h-[60vh] w-auto rounded-lg border object-contain"
        />
      </div>
    );
  }

  if (mimeType === "application/pdf" && previewUrl) {
    return (
      <iframe
        src={previewUrl}
        title={originalName}
        className="h-[60vh] w-full rounded-lg border"
      />
    );
  }

  if (mimeType.startsWith("video/") && previewUrl) {
    return (
      <video
        controls
        className="max-h-[60vh] w-full rounded-lg border"
        src={previewUrl}
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  if (mimeType.startsWith("audio/") && previewUrl) {
    return (
      <audio controls className="w-full" src={previewUrl}>
        Your browser does not support the audio tag.
      </audio>
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
