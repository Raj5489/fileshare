import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import CollectionPageClient from "./CollectionPageClient";

interface CollectionData {
  collection: {
    name: string;
    share_token: string;
    created_at: string;
    file_count: number;
  };
  files: {
    share_token: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    file_size_formatted: string;
    download_count: number;
    expires_at: string | null;
    is_expired: boolean;
  }[];
}

async function getCollectionData(
  token: string,
): Promise<CollectionData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/collections/share/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
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
    </div>
  );
}
