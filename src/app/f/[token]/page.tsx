import Navbar from "@/components/Navbar";
import SharePageClient from "./SharePageClient";
import Footer from "@/components/Footer";
import { FileX, Clock, ShieldOff } from "lucide-react";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSignedDownloadUrl } from "@/lib/r2";
import { formatBytes } from "@/lib/utils";

async function getFileMetadata(token: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(
      "[SharePage] Env check - url:",
      url?.slice(0, 30),
      "key_length:",
      key?.length,
    );

    const admin = getSupabaseAdmin();
    const { data: file, error } = await admin
      .from("files")
      .select(
        "id, share_token, original_name, mime_type, file_size, download_count, max_downloads, expires_at, is_deleted, password_hash, created_at, storage_key",
      )
      .eq("share_token", token)
      .maybeSingle();

    if (error) {
      console.error("[SharePage] DB error:", error.message, "token:", token);
      return null;
    }

    if (!file || file.is_deleted) {
      console.error("[SharePage] File not found or deleted:", {
        token,
        found: !!file,
        deleted: file?.is_deleted,
      });
      return null;
    }

    const is_expired = file.expires_at
      ? new Date(file.expires_at) < new Date()
      : false;
    const is_download_limit_reached =
      file.max_downloads !== null && file.download_count >= file.max_downloads;

    let preview_url: string | null = null;
    if (
      !is_expired &&
      !is_download_limit_reached &&
      (file.mime_type.startsWith("image/") ||
        file.mime_type === "application/pdf" ||
        file.mime_type.startsWith("video/") ||
        file.mime_type.startsWith("audio/"))
    ) {
      try {
        preview_url = await getSignedDownloadUrl(
          file.storage_key,
          file.original_name,
          3600,
        );
      } catch (previewErr) {
        console.error("[SharePage] Preview URL error:", previewErr);
      }
    }

    return {
      token: file.share_token,
      original_name: file.original_name,
      mime_type: file.mime_type,
      file_size: file.file_size,
      file_size_formatted: formatBytes(file.file_size),
      download_count: file.download_count,
      expires_at: file.expires_at,
      has_password: !!file.password_hash,
      is_expired,
      is_download_limit_reached,
      preview_url,
      created_at: file.created_at,
    };
  } catch (err) {
    console.error("[SharePage] Unexpected error for token:", token, err);
    return null;
  }
}

function ErrorPage({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          <Link
            href="/"
            className="mt-8 text-sm font-medium text-primary hover:underline"
          >
            ← Back to FileShare
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const metadata = await getFileMetadata(token);

  if (!metadata) {
    return (
      <ErrorPage
        icon={FileX}
        title="File not found"
        description="This file doesn't exist or has been removed by the owner."
      />
    );
  }

  if (metadata.is_expired) {
    return (
      <ErrorPage
        icon={Clock}
        title="Link expired"
        description="This share link has expired. Ask the sender to share a new link."
      />
    );
  }

  if (metadata.is_download_limit_reached) {
    return (
      <ErrorPage
        icon={ShieldOff}
        title="Download limit reached"
        description="This file has reached its maximum number of downloads and is no longer available."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <SharePageClient metadata={metadata} />
      </main>
      <Footer />
    </div>
  );
}
