import { ExternalLink, RefreshCw } from "lucide-react";
import type { AppStatus } from "@/app/api/health/route";

function overallStatus(app: AppStatus): "healthy" | "degraded" | "down" | "unknown" {
  const hasK8sData = app.deployment !== null || app.pods.total > 0;
  if (!hasK8sData && app.endpoints.length === 0) return "unknown";

  const endpointsDown = app.endpoints.every((e) => e.status === "down");
  const endpointsDegraded = app.endpoints.some((e) => e.status === "down");

  if (hasK8sData && app.pods.running === 0) return "down";
  if (endpointsDown) return "down";
  if (endpointsDegraded) return "degraded";
  if (
    app.deployment &&
    app.deployment.ready < app.deployment.desired
  )
    return "degraded";
  return "healthy";
}

const STATUS_STYLES = {
  healthy: {
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
    badge: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
    label: "Healthy",
  },
  degraded: {
    border: "border-amber-500/40",
    dot: "bg-amber-400",
    badge: "bg-amber-900/40 text-amber-300 border-amber-700/50",
    label: "Degraded",
  },
  down: {
    border: "border-red-500/40",
    dot: "bg-red-400 animate-pulse",
    badge: "bg-red-900/40 text-red-300 border-red-700/50",
    label: "Down",
  },
  unknown: {
    border: "border-slate-600/40",
    dot: "bg-slate-500",
    badge: "bg-slate-800/60 text-slate-400 border-slate-600/50",
    label: "Unknown",
  },
};

function HttpBadge({ code }: { code: number | null }) {
  if (code === null) return <span className="text-slate-500">—</span>;
  const color =
    code < 300
      ? "text-emerald-400"
      : code < 400
      ? "text-sky-400"
      : code < 500
      ? "text-amber-400"
      : "text-red-400";
  return <span className={color}>{code}</span>;
}

export function AppCard({ app }: { app: AppStatus }) {
  const status = overallStatus(app);
  const styles = STATUS_STYLES[status];

  return (
    <div
      className={`rounded-xl border ${styles.border} bg-slate-900/60 backdrop-blur p-5 flex flex-col gap-4`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ${styles.dot}`}
            />
            <h2 className="font-semibold text-slate-100 truncate">{app.name}</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">{app.namespace}</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${styles.badge}`}
        >
          {styles.label}
        </span>
      </div>

      {/* Hosts */}
      <div className="space-y-1">
        {app.hosts.map((h) => (
          <a
            key={h.host}
            href={`https://${h.host}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm font-mono truncate"
          >
            <ExternalLink size={12} className="shrink-0" />
            {h.host}
          </a>
        ))}
      </div>

      <div className="h-px bg-slate-700/50" />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {/* Pods */}
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Pods</div>
          {app.pods.total === 0 ? (
            <span className="text-slate-500">—</span>
          ) : (
            <span
              className={
                app.pods.ready === app.pods.total
                  ? "text-emerald-400"
                  : app.pods.ready === 0
                  ? "text-red-400"
                  : "text-amber-400"
              }
            >
              {app.pods.ready}/{app.pods.total} ready
            </span>
          )}
        </div>

        {/* Deployment */}
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Replicas</div>
          {app.deployment ? (
            <span
              className={
                app.deployment.ready >= app.deployment.desired
                  ? "text-emerald-400"
                  : "text-amber-400"
              }
            >
              {app.deployment.ready}/{app.deployment.desired}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </div>

        {/* Restarts */}
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Restarts</div>
          <span
            className={app.pods.restarts > 0 ? "text-amber-400" : "text-slate-400"}
          >
            {app.pods.restarts}
          </span>
        </div>

        {/* Endpoint count */}
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Endpoints</div>
          <span className="text-slate-400">{app.endpoints.length}</span>
        </div>
      </div>

      {/* Endpoint checks */}
      {app.endpoints.length > 0 && (
        <div className="space-y-1.5">
          {app.endpoints.map((ep) => (
            <div
              key={ep.url}
              className="flex items-center justify-between text-xs font-mono"
            >
              <span className="text-slate-400 truncate mr-2">{ep.url}</span>
              <span className="flex items-center gap-2 shrink-0">
                <HttpBadge code={ep.httpCode} />
                {ep.latencyMs !== null && (
                  <span className="text-slate-500">{ep.latencyMs}ms</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1 text-xs text-slate-600">
        <RefreshCw size={10} />
        <span>
          {new Date(app.checkedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
