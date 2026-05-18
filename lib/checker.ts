export interface EndpointResult {
  url: string;
  status: "up" | "down" | "unknown";
  httpCode: number | null;
  latencyMs: number | null;
}

export async function checkEndpoint(url: string): Promise<EndpointResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      url,
      status: res.status < 500 ? "up" : "down",
      httpCode: res.status,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { url, status: "down", httpCode: null, latencyMs: null };
  }
}
