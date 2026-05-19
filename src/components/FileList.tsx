"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy,
  Trash2,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
  File as FileIcon,
  Image,
  FileText,
  Film,
  Music,
  Archive,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";

interface FileItem {
  id: string;
  share_token: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  download_count: number;
  max_downloads: number | null;
  expires_at: string | null;
  created_at: string;
}

interface FileListProps {
  initialFiles: FileItem[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("7z"))
    return Archive;
  return FileIcon;
}

export default function FileList({ initialFiles, initialPagination }: FileListProps) {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchPage(page: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?page=${page}&limit=${pagination.limit}`);
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch files.");
      }
    } catch {
      toast.error("Failed to fetch files.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(token: string, id: string) {
    if (!confirm("Are you sure you want to delete this file?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/files/${token}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        toast.success("File deleted.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete file.");
      }
    } catch {
      toast.error("Failed to delete file.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopyLink(token: string) {
    const url = `${window.location.origin}/f/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  async function handleExtendExpiry(token: string) {
    const res = await fetch(`/api/files/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expires_in: "30d" }),
    });
    if (res.ok) {
      toast.success("Expiry extended to 30 days.");
      fetchPage(pagination.page);
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to extend expiry.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Downloads</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No files uploaded yet.
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => {
                const Icon = getFileIcon(file.mime_type);
                const isExpired = file.expires_at
                  ? new Date(file.expires_at) < new Date()
                  : false;

                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <Link
                          href={`/f/${file.share_token}`}
                          className="font-medium hover:underline"
                        >
                          {file.original_name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(file.file_size)}</TableCell>
                    <TableCell>{formatDate(file.created_at)}</TableCell>
                    <TableCell>
                      {file.expires_at ? (
                        <span className={isExpired ? "text-destructive" : ""}>
                          {formatDate(file.expires_at)}
                        </span>
                      ) : (
                        <Badge variant="secondary">Never</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {file.download_count}
                      {file.max_downloads !== null &&
                        ` / ${file.max_downloads}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(file.share_token)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExtendExpiry(file.share_token)}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDelete(file.share_token, file.id)
                          }
                          disabled={deletingId === file.id}
                        >
                          {deletingId === file.id ? (
                            <Download className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
