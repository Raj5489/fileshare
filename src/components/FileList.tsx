"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy,
  Trash2,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  CheckSquare,
  Square,
  Minus,
} from "lucide-react";
import { formatBytes, formatDate, getFileIcon } from "@/lib/utils";

const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 Hour" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "never", label: "Never expire" },
] as const;

type ExpiryOption = (typeof EXPIRY_OPTIONS)[number]["value"];

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
  collection_id: string | null;
}

interface Collection {
  id: string;
  name: string;
  share_token: string;
}

interface FileListProps {
  initialFiles: FileItem[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onRefresh?: (page: number) => void;
  onFilesChanged?: () => void;
  collections?: Collection[];
  loading?: boolean;
}

export default function FileList({
  initialFiles,
  initialPagination,
  onRefresh,
  onFilesChanged,
  collections = [],
  loading: externalLoading = false,
}: FileListProps) {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Expiry dialog
  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false);
  const [expiryToken, setExpiryToken] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryOption>("30d");
  const [expiryLoading, setExpiryLoading] = useState(false);

  // Move to folder dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTokens, setMoveTokens] = useState<string[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);
  useEffect(() => {
    setPagination(initialPagination);
  }, [initialPagination]);
  useEffect(() => {
    setSelected(new Set());
  }, [initialFiles]);

  const isAllSelected = files.length > 0 && selected.size === files.length;
  const isSomeSelected = selected.size > 0 && selected.size < files.length;

  function toggleAll() {
    setSelected(
      isAllSelected ? new Set() : new Set(files.map((f) => f.share_token)),
    );
  }

  function toggleOne(token: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(token) ? next.delete(token) : next.add(token);
      return next;
    });
  }

  async function fetchPage(page: number) {
    if (onRefresh) {
      onRefresh(page);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files?page=${page}&limit=${pagination.limit}`,
      );
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files);
        setPagination(data.pagination);
      } else toast.error(data.error || "Failed to fetch files.");
    } catch {
      toast.error("Failed to fetch files.");
    } finally {
      setLoading(false);
    }
  }

  function refresh() {
    // Always notify parent to re-fetch (keeps allFiles in sync)
    if (onFilesChanged) {
      onFilesChanged();
    } else {
      fetchPage(pagination.page);
    }
  }

  async function handleDelete(token: string, id: string) {
    if (!confirm("Delete this file?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/files/${token}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("File deleted.");
        // Optimistically remove from local state immediately
        setFiles((prev) => prev.filter((f) => f.id !== id));
        refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to delete.");
      }
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    if (
      !confirm(`Delete ${selected.size} file${selected.size > 1 ? "s" : ""}?`)
    )
      return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          tokens: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Deleted ${data.affected} file${data.affected > 1 ? "s" : ""}.`,
        );
        // Optimistically remove from local state immediately
        setFiles((prev) => prev.filter((f) => !selected.has(f.share_token)));
        setSelected(new Set());
        refresh();
      } else {
        toast.error(data.error || "Bulk delete failed.");
      }
    } catch {
      toast.error("Bulk delete failed.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleCopyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/f/${token}`);
    toast.success("Link copied!");
  }

  function openExpiryDialog(token: string | null) {
    setExpiryToken(token);
    setSelectedExpiry("30d");
    setExpiryDialogOpen(true);
  }

  async function handleExpiryConfirm() {
    setExpiryLoading(true);
    try {
      const isBulk = expiryToken === null;
      const tokens = isBulk ? Array.from(selected) : [expiryToken!];
      const res = isBulk
        ? await fetch("/api/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "set_expiry",
              tokens,
              expires_in: selectedExpiry,
            }),
          })
        : await fetch(`/api/files/${expiryToken}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expires_in: selectedExpiry }),
          });

      if (res.ok) {
        const label = EXPIRY_OPTIONS.find(
          (o) => o.value === selectedExpiry,
        )?.label;
        toast.success(`Expiry set to: ${label}`);
        setExpiryDialogOpen(false);
        if (isBulk) setSelected(new Set());
        refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to update expiry.");
      }
    } catch {
      toast.error("Failed to update expiry.");
    } finally {
      setExpiryLoading(false);
    }
  }

  function openMoveDialog(tokens: string[]) {
    setMoveTokens(tokens);
    setMoveTarget(null);
    setMoveDialogOpen(true);
  }

  async function handleMoveConfirm() {
    setMoveLoading(true);
    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_to_collection",
          tokens: moveTokens,
          collection_id: moveTarget,
        }),
      });
      if (res.ok) {
        toast.success(moveTarget ? "Moved to folder." : "Removed from folder.");
        setMoveDialogOpen(false);
        setSelected(new Set());
        refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to move files.");
      }
    } catch {
      toast.error("Failed to move files.");
    } finally {
      setMoveLoading(false);
    }
  }

  const isLoading = loading || externalLoading;

  return (
    <div className="space-y-3">
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border bg-primary/5 border-primary/20 px-4 py-2.5">
          <span className="text-sm font-medium text-primary mr-2">
            {selected.size} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => openExpiryDialog(null)}
          >
            <Clock className="h-3.5 w-3.5" />
            Set Expiry
          </Button>
          {collections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openMoveDialog(Array.from(selected))}
            >
              <FolderInput className="h-3.5 w-3.5" />
              Move to Folder
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Desktop table (md and above) ── */}
      <div className="hidden md:block rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <button
                  onClick={toggleAll}
                  className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {isAllSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : isSomeSelected ? (
                    <Minus className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </TableHead>
              <TableHead>File</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Downloads</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-10"
                >
                  No files here yet.
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => {
                const Icon = getFileIcon(file.mime_type);
                const isExpired = file.expires_at
                  ? new Date(file.expires_at) < new Date()
                  : false;
                const isSelected = selected.has(file.share_token);
                return (
                  <TableRow
                    key={file.id}
                    className={isSelected ? "bg-primary/5" : undefined}
                  >
                    <TableCell>
                      <button
                        onClick={() => toggleOne(file.share_token)}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <Link
                            href={`/f/${file.share_token}`}
                            className="font-medium hover:underline truncate block"
                          >
                            {file.original_name}
                          </Link>
                          {file.collection_id && collections.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {
                                collections.find(
                                  (c) => c.id === file.collection_id,
                                )?.name
                              }
                            </span>
                          )}
                        </div>
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
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(file.share_token)}
                          title="Copy link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openExpiryDialog(file.share_token)}
                          title="Set expiry"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        {collections.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openMoveDialog([file.share_token])}
                            title="Move to folder"
                          >
                            <FolderInput className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDelete(file.share_token, file.id)
                          }
                          disabled={deletingId === file.id}
                          title="Delete"
                        >
                          {deletingId === file.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
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

      {/* ── Mobile cards (below md) ── */}
      <div className="md:hidden space-y-2">
        {/* Mobile select-all bar */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : isSomeSelected ? (
                <Minus className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>{isAllSelected ? "Deselect all" : "Select all"}</span>
            </button>
            {selected.size > 0 && (
              <span className="ml-auto text-xs text-primary font-medium">
                {selected.size} selected
              </span>
            )}
          </div>
        )}
        {isLoading && files.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">
            No files here yet.
          </p>
        ) : (
          files.map((file) => {
            const Icon = getFileIcon(file.mime_type);
            const isExpired = file.expires_at
              ? new Date(file.expires_at) < new Date()
              : false;
            const isSelected = selected.has(file.share_token);
            return (
              <div
                key={file.id}
                className={`rounded-xl border bg-card p-3 ${isSelected ? "border-primary/40 bg-primary/5" : ""}`}
              >
                {/* Row 1: checkbox + icon + filename */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleOne(file.share_token)}
                    className="shrink-0 text-muted-foreground"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Link
                    href={`/f/${file.share_token}`}
                    className="text-sm font-medium hover:underline truncate flex-1"
                  >
                    {file.original_name}
                  </Link>
                </div>
                {/* Row 2: meta info */}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground pl-10">
                  <span>{formatBytes(file.file_size)}</span>
                  <span className={isExpired ? "text-destructive" : ""}>
                    {file.expires_at
                      ? formatDate(file.expires_at)
                      : "Never expires"}
                  </span>
                  <span>
                    {file.download_count}
                    {file.max_downloads !== null && `/${file.max_downloads}`} dl
                  </span>
                </div>
                {/* Row 3: action buttons — always visible, no scroll */}
                <div className="mt-2 flex items-center gap-1 pl-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(file.share_token)}
                    className="h-7 px-2 text-xs gap-1 flex-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openExpiryDialog(file.share_token)}
                    className="h-7 px-2 text-xs gap-1 flex-1"
                  >
                    <Clock className="h-3 w-3" />
                    Expiry
                  </Button>
                  {collections.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openMoveDialog([file.share_token])}
                      className="h-7 px-2 text-xs gap-1 flex-1"
                    >
                      <FolderInput className="h-3 w-3" />
                      Move
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.share_token, file.id)}
                    disabled={deletingId === file.id}
                    className="h-7 px-2 text-xs gap-1 flex-1 text-destructive hover:text-destructive"
                  >
                    {deletingId === file.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(pagination.page - 1)}
            disabled={pagination.page <= 1 || isLoading}
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
            disabled={pagination.page >= pagination.totalPages || isLoading}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Expiry dialog */}
      <Dialog open={expiryDialogOpen} onOpenChange={setExpiryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {expiryToken === null
                ? `Set Expiry for ${selected.size} Files`
                : "Set Expiry"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose when the file link should expire.
          </p>
          <div className="grid grid-cols-1 gap-2 py-2">
            {EXPIRY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedExpiry(option.value)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors ${
                  selectedExpiry === option.value
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span>{option.label}</span>
                {selectedExpiry === option.value && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExpiryDialogOpen(false)}
              disabled={expiryLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleExpiryConfirm} disabled={expiryLoading}>
              {expiryLoading ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to folder dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose a destination folder.
          </p>
          <div className="grid grid-cols-1 gap-2 py-2">
            <button
              type="button"
              onClick={() => setMoveTarget(null)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                moveTarget === null
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className="text-muted-foreground">—</span>
              <span>No folder (remove)</span>
            </button>
            {collections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setMoveTarget(col.id)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  moveTarget === col.id
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <FolderInput className="h-4 w-4 shrink-0" />
                {col.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveDialogOpen(false)}
              disabled={moveLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleMoveConfirm} disabled={moveLoading}>
              {moveLoading ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
