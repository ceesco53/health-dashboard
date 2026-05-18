"use client";
import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import type { HealthResponse } from "@/app/api/health/route";

const REFRESH_INTERVAL_MS = 30_000;

export default function Page() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <Dashboard data={data} loading={loading} lastFetch={lastFetch} onRefresh={refresh} />
  );
}
