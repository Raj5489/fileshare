import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CollectionPageClient from "./CollectionPageClient";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatBytes } from "@/lib/utils";

async function getCollectionData(token: string) {
  const admin = getSupabaseAdmin();

  const { data: collection, error } = await admin
    .from("collections")
    .select("id, name, share_token, created_at")
    .eq("share_token", token)
    .single();

  if (error || !collection) return null;

  const { data: files } = await admin
    .from("files")
    .select(
      "share_token, original_name, mime_type, file_size, download_count, expires_at, created_at",
    )
    .eq("collection_id", collection.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const fileList = (files || []).map((f) => ({
    ...f,
    file_size_formatted: formatBytes(f.file_size),
    is_expired: f.expires_at ? new Date(f.expires_at) < new Date() : false,
  }));

  return {
    collection: {
      name: collection.name,
      share_token: collection.share_token,
      created_at: collection.created_at,
      file_count: fileList.length,
    },
    files: fileList,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getCollectionData(token);
  if (!data) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-12">
        <CollectionPageClient data={data} />
      </main>
      <Footer />
    </div>
  );
}
