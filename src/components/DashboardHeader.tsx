"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UploadCloud } from "lucide-react";
import UploadZone from "@/components/UploadZone";

export default function DashboardHeader() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleUploadSuccess = () => {
    router.refresh();
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Block closing the dialog while an upload is in progress
    if (!newOpen && uploading) return;
    setOpen(newOpen);
    if (!newOpen) {
      router.refresh();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold tracking-tight">My Files</h1>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger>
          <Button className="gap-2">
            <UploadCloud className="h-4 w-4" />
            Upload File
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          {uploading && (
            <p className="text-xs text-muted-foreground text-center -mt-2 mb-1">
              Upload in progress — please don&apos;t close this window.
            </p>
          )}
          <div className="flex justify-center py-4">
            <UploadZone
              onUploadSuccess={handleUploadSuccess}
              onUploadingChange={setUploading}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
