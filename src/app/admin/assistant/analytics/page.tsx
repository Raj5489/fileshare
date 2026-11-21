"use client";

import { useState, useEffect } from "react";
import { BarChart3, RefreshCw } from "lucide-react";

interface AnalyticsData {
  period: { from: string; to: string };
  dailyConversations: Array<{
    date: string;
    web: number;
    telegram: number;
    total: number;
  }>;
  channelDistribution: { web: number; telegram: number; total: number };
  ticketResolution: {
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    total: number;
  };
  knowledgeBase: {
    byCategory: Record<string, { active: number; inactive: number }>;
    totalActive: number;
    totalInactive: number;
  };
  feedback: {
    total: number;
    averageRating: number | null;
    distribution: Record<number, number>;
  };
}

function Bar({
  value,
  max,
  color = "bg-primary",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/admin/analytics");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading analytics…
      </div>
    );

  if (!data)
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Failed to load analytics.
      </div>
    );

  const maxDaily = Math.max(...data.dailyConversations.map((d) => d.total), 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Last 30 days · real data
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Channel distribution */}
        <Section title="Channel Distribution">
          {data.channelDistribution.total === 0 ? (
            <p className="text-xs text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[
                {
                  label: "Web",
                  value: data.channelDistribution.web,
                  color: "bg-primary",
                },
                {
                  label: "Telegram",
                  value: data.channelDistribution.telegram,
                  color: "bg-sky-500",
                },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{label}</span>
                    <span className="text-muted-foreground">
                      {data.channelDistribution.total > 0
                        ? Math.round(
                            (value / data.channelDistribution.total) * 100,
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <Bar
                    value={value}
                    max={data.channelDistribution.total}
                    color={color}
                  />
                </div>
              ))}
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {data.channelDistribution.total} total
              </p>
            </div>
          )}
        </Section>

        {/* Ticket status */}
        <Section title="Ticket Status">
          {data.ticketResolution.total === 0 ? (
            <p className="text-xs text-muted-foreground">No tickets yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(data.ticketResolution.byStatus).map(
                ([status, count]) => (
                  <div key={status}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize">
                        {status.replace("_", " ")}
                      </span>
                    </div>
                    <Bar value={count} max={data.ticketResolution.total} />
                  </div>
                ),
              )}
            </div>
          )}
        </Section>

        {/* Feedback */}
        <Section title="Customer Feedback">
          {data.feedback.total === 0 ? (
            <p className="text-xs text-muted-foreground">No feedback yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {data.feedback.averageRating?.toFixed(1) ?? "—"}
                </span>
                <span className="text-sm text-muted-foreground">/ 5 avg</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.feedback.total} ratings
                </span>
              </div>
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-3 text-xs text-muted-foreground">
                    {star}★
                  </span>
                  <Bar
                    value={data.feedback.distribution[star] ?? 0}
                    max={data.feedback.total}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Daily conversations chart */}
      <Section title="Daily Conversations (Last 30 Days)">
        {data.dailyConversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <BarChart3 className="h-8 w-8 opacity-30" />
            <p>No data yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-1 pb-1"
              style={{ minWidth: `${data.dailyConversations.length * 28}px` }}
            >
              {data.dailyConversations.map((d) => {
                const h =
                  maxDaily > 0
                    ? Math.max(4, Math.round((d.total / maxDaily) * 80))
                    : 4;
                return (
                  <div
                    key={d.date}
                    className="group flex flex-1 flex-col items-center gap-0.5"
                  >
                    <div className="relative flex flex-col items-center">
                      <div className="invisible absolute -top-7 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[9px] text-background group-hover:visible">
                        {d.date}: {d.total}
                      </div>
                      <div
                        className="w-full min-w-[6px] rounded-t bg-primary/70 transition-all group-hover:bg-primary"
                        style={{ height: `${h}px` }}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground rotate-90 origin-center mt-2 w-6 text-center truncate">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* KB category breakdown */}
      <Section title="Knowledge Base by Category">
        {Object.keys(data.knowledgeBase.byCategory).length === 0 ? (
          <p className="text-xs text-muted-foreground">No KB entries.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {Object.entries(data.knowledgeBase.byCategory).map(
              ([cat, counts]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="font-medium capitalize">{cat}</span>
                  <span className="text-muted-foreground">
                    {counts.active} active · {counts.inactive} inactive
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </Section>

      {/* Ticket categories */}
      {Object.keys(data.ticketResolution.byCategory).length > 0 && (
        <Section title="Tickets by Category">
          <div className="flex flex-col gap-2">
            {Object.entries(data.ticketResolution.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <Bar value={count} max={data.ticketResolution.total} />
                </div>
              ))}
          </div>
        </Section>
      )}
    </div>
  );
}
