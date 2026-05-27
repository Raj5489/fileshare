"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  UploadCloud,
  FileText,
  HardDrive,
  Download,
  FolderPlus,
  FolderOpen,
  Folder,
  Trash2,
  Copy,
  Pencil,
  ExternalLink,
} from "lucide-react";
import UploadZone from "@/components/UploadZone";
import FileList from "@/components/FileList";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

interface Stats {
  file_count: number;
  storage_used: number;
  total_downloads: number;
}

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function DashboardClient() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    file_count: 0,
    storage_used: 0,
    total_downloads: 0,
  });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Collection management
  const [activeCollection, setActiveCollection] = useState<string | null>(null); // null = All Files
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColLoading, setNewColLoading] = useState(false);
  const [renameColOpen, setRenameColOpen] = useState(false);
  const [renameColId, setRenameColId] = useState<string | null>(null);
  const [renameColName, setRenameColName] = useState("");

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?page=${page}&limit=20`);
      const data = await res.json();
      if (res.ok) {
        setAllFiles(data.files);
        setPagination(data.pagination);
        setStats(data.stats);
        setCollections(data.collections || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Refresh when user switches back to this tab
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchData(1);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter files by active collection
  useEffect(() => {
    if (activeCollection === null) {
      setFiles(allFiles);
    } else {
      setFiles(allFiles.filter((f) => f.collection_id === activeCollection));
    }
  }, [allFiles, activeCollection]);

  function handleUploadSuccess() {
    // Don't close the dialog — let the user see the share link first.
    // fetchData is called when they close the dialog via handleOpenChange.
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && uploading) return;
    setUploadOpen(newOpen);
    if (!newOpen) fetchData(1);
  }

  async function handleCreateCollection() {
    if (!newColName.trim()) return;
    setNewColLoading(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Collection created.");
        setCollections((prev) => [data.collection, ...prev]);
        setNewColName("");
        setNewColOpen(false);
      } else {
        toast.error(data.error || "Failed to create collection.");
      }
    } finally {
      setNewColLoading(false);
    }
  }

  async function handleRenameCollection() {
    if (!renameColId || !renameColName.trim()) return;
    const res = await fetch(`/api/collections/${renameColId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameColName.trim() }),
    });
    if (res.ok) {
      toast.success("Collection renamed.");
      setCollections((prev) =>
        prev.map((c) =>
          c.id === renameColId ? { ...c, name: renameColName.trim() } : c,
        ),
      );
      setRenameColOpen(false);
    } else {
      toast.error("Failed to rename collection.");
    }
  }

  async function handleDeleteCollection(id: string) {
    if (!confirm("Delete this folder? Files inside will stay in All Files."))
      return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Folder deleted. Files moved to All Files.");
      if (activeCollection === id) setActiveCollection(null);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      // Immediately clear collection_id on affected files in local state
      // so they appear in All Files right away without waiting for fetchData
      setAllFiles((prev) =>
        prev.map((f) =>
          f.collection_id === id ? { ...f, collection_id: null } : f,
        ),
      );
      fetchData(1);
    } else {
      toast.error("Failed to delete folder.");
    }
  }

  async function handleCopyCollectionLink(shareToken: string) {
    const url = `${window.location.origin}/c/${shareToken}`;
    await navigator.clipboard.writeText(url);
    toast.success("Collection link copied!");
  }

  const activeCollectionData = collections.find(
    (c) => c.id === activeCollection,
  );
  const filteredPagination = activeCollection
    ? {
        ...pagination,
        total: files.length,
        totalPages: Math.ceil(files.length / pagination.limit),
      }
    : pagination;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">
            My Files
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.file_count > 0
              ? `${stats.file_count} file${stats.file_count !== 1 ? "s" : ""} · ${formatBytes(stats.storage_used)} used`
              : "Upload your first file to get started"}
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger>
            <Button className="gap-2 btn-shimmer text-white shadow-md shadow-primary/20">
              <UploadCloud className="h-4 w-4" />
              Upload Files
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Files</DialogTitle>
            </DialogHeader>
            {uploading && (
              <p className="text-xs text-muted-foreground text-center -mt-2 mb-1">
                Upload in progress — please don&apos;t close this window.
              </p>
            )}
            <div className="flex justify-center py-2">
              <UploadZone
                onUploadSuccess={handleUploadSuccess}
                onUploadingChange={setUploading}
                defaultCollectionId={activeCollection ?? undefined}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Files"
          value={String(stats.file_count)}
          color="blue"
        />
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Storage"
          value={formatBytes(stats.storage_used)}
          color="violet"
        />
        <StatCard
          icon={<Download className="h-4 w-4" />}
          label="Downloads"
          value={String(stats.total_downloads)}
          color="green"
        />
      </div>

      {/* Mobile: folders as horizontal strip. Desktop: sidebar + content */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Collections — horizontal on mobile, vertical sidebar on desktop */}
        <aside className="lg:w-52 lg:shrink-0">
          {/* Mobile folder strip */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 lg:hidden scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              onClick={() => setActiveCollection(null)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                activeCollection === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "bg-muted text-foreground"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              All
            </button>
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap max-w-[120px] ${
                  activeCollection === col.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "bg-muted text-foreground"
                }`}
              >
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{col.name}</span>
              </button>
            ))}
            <button
              onClick={() => setNewColOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Folders
              </p>
              <button
                onClick={() => setNewColOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="New folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={() => setActiveCollection(null)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                activeCollection === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">All Files</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {stats.file_count}
              </span>
            </button>

            {collections.map((col) => {
              const count = allFiles.filter(
                (f) => f.collection_id === col.id,
              ).length;
              return (
                <div key={col.id} className="group relative">
                  <button
                    onClick={() => setActiveCollection(col.id)}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                      activeCollection === col.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate">{col.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground group-hover:invisible">
                      {count}
                    </span>
                  </button>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={() => handleCopyCollectionLink(col.share_token)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Copy share link"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        setRenameColId(col.id);
                        setRenameColName(col.name);
                        setRenameColOpen(true);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteCollection(col.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete folder"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {collections.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No folders yet.
              </p>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Collection header bar */}
          {activeCollectionData && (
            <div className="mb-4 flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Folder className="h-4 w-4 text-primary" />
                {activeCollectionData.name}
              </div>
              <a
                href={`/c/${activeCollectionData.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Share folder
              </a>
            </div>
          )}

          <FileList
            initialFiles={files}
            initialPagination={filteredPagination}
            onRefresh={fetchData}
            collections={collections}
            onFilesChanged={() => fetchData(pagination.page)}
            loading={loading}
          />
        </div>
      </div>

      {/* New collection dialog */}
      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewColOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={newColLoading || !newColName.trim()}
            >
              {newColLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename collection dialog */}
      <Dialog open={renameColOpen} onOpenChange={setRenameColOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameColName}
            onChange={(e) => setRenameColName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameCollection()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameColOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameCollection}
              disabled={!renameColName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const colorMap = {
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-600",
    glow: "shadow-blue-500/20",
    gradient: "from-blue-500/8 to-indigo-500/5",
    border: "hover:border-blue-300/50",
    bar: "bg-gradient-to-r from-blue-400 to-indigo-500",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-600",
    glow: "shadow-violet-500/20",
    gradient: "from-violet-500/8 to-purple-500/5",
    border: "hover:border-violet-300/50",
    bar: "bg-gradient-to-r from-violet-400 to-purple-500",
  },
  green: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    glow: "shadow-emerald-500/20",
    gradient: "from-emerald-500/8 to-teal-500/5",
    border: "hover:border-emerald-300/50",
    bar: "bg-gradient-to-r from-emerald-400 to-teal-500",
  },
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: keyof typeof colorMap;
}) {
  const c = colorMap[color];
  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5
        shadow-sm transition-all duration-300 cursor-default
        hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]
        ${c.glow} ${c.border}
        [transform-style:preserve-3d]
      `}
      style={{ perspective: "600px" }}
    >
      {/* Gradient wash */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
      />

      {/* Top accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 ${c.bar} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      {/* Shine sweep on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden rounded-2xl">
        <div className="absolute -inset-full top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/8 to-transparent translate-x-[-100%] group-hover:translate-x-[300%] transition-transform duration-700" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] sm:text-sm font-medium text-muted-foreground leading-tight">
            {label}
          </p>
          <div
            className={`flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text} shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
          >
            {icon}
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-xl sm:text-3xl font-bold tracking-tight break-all leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
