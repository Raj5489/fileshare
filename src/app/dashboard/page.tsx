import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";
import FileList from "@/components/FileList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, HardDrive, Download } from "lucide-react";
import { formatBytes } from "@/lib/utils";

async function getDashboardData(userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const [profileRes, filesRes] = await Promise.all([
    fetch(`${baseUrl}/api/files`, {
      headers: { cookie: "" }, // cookies are handled by middleware
      next: { revalidate: 0 },
    }).catch(() => null),
    fetch(`${baseUrl}/api/files?page=1&limit=20`, {
      next: { revalidate: 0 },
    }).catch(() => null),
  ]);

  // We need to use the server client to get files since the /api/files endpoint requires auth cookies
  // which aren't automatically forwarded in server component fetch calls.
  // Instead, let's query Supabase directly.
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("storage_used, file_count")
    .eq("id", userId)
    .single();

  const { data: files, count } = await supabase
    .from("files")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range(0, 19);

  const totalDownloads =
    files?.reduce((sum, f) => sum + (f.download_count || 0), 0) || 0;

  return {
    profile: {
      storage_used: profile?.storage_used || 0,
      file_count: profile?.file_count || 0,
    },
    files: files || [],
    pagination: {
      page: 1,
      limit: 20,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / 20),
    },
    totalDownloads,
  };
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const data = await getDashboardData(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">My Files</h1>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<FileText className="h-5 w-5 text-primary" />}
            title="Total Files"
            value={String(data.profile.file_count)}
          />
          <SummaryCard
            icon={<HardDrive className="h-5 w-5 text-primary" />}
            title="Storage Used"
            value={formatBytes(data.profile.storage_used)}
          />
          <SummaryCard
            icon={<Download className="h-5 w-5 text-primary" />}
            title="Total Downloads"
            value={String(data.totalDownloads)}
          />
        </div>

        <div className="mt-8">
          <FileList
            initialFiles={data.files}
            initialPagination={data.pagination}
          />
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
