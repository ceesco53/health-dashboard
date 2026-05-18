"use client";
import { RefreshCw, Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { AppCard } from "./AppCard";
import type { HealthResponse, AppStatus } from "@/app/api/health/route";

function appOverallStatus(app: AppStatus): "healthy" | "degraded" | "down" | "unknown" {
  const hasK8sData = app.deployment !== null || app.pods.total > 0;
  if (!hasK8sData && app.endpoints.length === 0) return "unknown";
  const endpointsDown = app.endpoints.every((e) => e.status === "down");
  const endpointsDegraded = app.endpoints.some((e) => e.status === "down");
  if (hasK8sData && app.pods.running === 0) return "down";
  if (endpointsDown) return "down";
  if (endpointsDegraded) return "degraded";
  if (app.deployment && app.deployment.ready < app.deployment.desired) return "degraded";
  return "healthy";
}

interface Props {
  data: HealthResponse | null;
  loading: boolean;
  lastFetch: Date | null;
  onRefresh: () => void;
}

export function Dashboard({ data, loading, lastFetch, onRefresh }: Props) {
  const apps = data?.apps ?? [];
  const counts = {
    healthy: apps.filter((a) => appOverallStatus(a) === "healthy").length,
    degraded: apps.filter((a) => appOverallStatus(a) === "degraded").length,
    down: apps.filter((a) => appOverallStatus(a) === "down").length,
    unknown: apps.filter((a) => appOverallStatus(a) === "unknown").length,
  };

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={22} className="text-sky-400" />
            <div>
              <h1 className="font-bold text-lg leading-none">Cluster Health</h1>
              <p className="text-xs text-slate-500 mt-0.5">ingress.realmclick.com</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lastFetch && (
              <span className="text-xs text-slate-500 hidden sm:block">
                Updated {lastFetch.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={<CheckCircle size={18} className="text-emerald-400" />}
            label="Healthy"
            value={counts.healthy}
            color="text-emerald-400"
          />
          <SummaryCard
            icon={<AlertTriangle size={18} className="text-amber-400" />}
            label="Degraded"
            value={counts.degraded}
            color="text-amber-400"
          />
          <SummaryCard
            icon={<XCircle size={18} className="text-red-400" />}
            label="Down"
            value={counts.down}
            color="text-red-400"
          />
          <SummaryCard
            icon={<Activity size={18} className="text-slate-400" />}
            label="Total Apps"
            value={apps.length}
            color="text-slate-300"
          />
        </div>

        {/* App grid */}
        {loading && apps.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Fetching cluster data…
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-500 text-sm">
              No apps found under{" "}
              <span className="font-mono text-slate-400">*.ingress.realmclick.com</span>
            </p>
            <p className="text-slate-600 text-xs mt-2">
              {data?.inCluster === false
                ? "Running outside cluster — k8s API unavailable"
                : "Check ClusterRole permissions and ingress hostnames"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard key={`${app.namespace}/${app.name}`} app={app} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
      {icon}
      <div>
        <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
