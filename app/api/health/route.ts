import { NextResponse } from "next/server";
import { listIngresses, listDeployments, listPods } from "@/lib/k8s";
import { checkEndpoint, EndpointResult } from "@/lib/checker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INGRESS_DOMAIN = "ingress.realmclick.com";

export interface AppStatus {
  name: string;
  namespace: string;
  hosts: Array<{ host: string; paths: string[]; serviceName: string }>;
  deployment: {
    name: string;
    desired: number;
    available: number;
    ready: number;
  } | null;
  pods: { total: number; running: number; ready: number; restarts: number };
  endpoints: EndpointResult[];
  checkedAt: string;
}

export interface HealthResponse {
  apps: AppStatus[];
  fetchedAt: string;
  inCluster: boolean;
}

export async function GET() {
  const allIngresses = await listIngresses();

  const relevant = allIngresses.filter((ing) =>
    ing.spec.rules?.some(
      (r) => r.host?.endsWith(`.${INGRESS_DOMAIN}`) || r.host === INGRESS_DOMAIN
    )
  );

  const namespaces = [...new Set(relevant.map((i) => i.metadata.namespace))];

  const [deploymentsByNs, podsByNs] = await Promise.all([
    Promise.all(
      namespaces.map((ns) => listDeployments(ns).then((d) => ({ ns, d })))
    ),
    Promise.all(namespaces.map((ns) => listPods(ns).then((p) => ({ ns, p })))),
  ]);

  const deploymentsMap = Object.fromEntries(
    deploymentsByNs.map(({ ns, d }) => [ns, d])
  );
  const podsMap = Object.fromEntries(podsByNs.map(({ ns, p }) => [ns, p]));

  const apps: AppStatus[] = await Promise.all(
    relevant.map(async (ing) => {
      const ns = ing.metadata.namespace;
      const name = ing.metadata.name;

      const hosts = (ing.spec.rules ?? [])
        .filter(
          (r) =>
            r.host?.endsWith(`.${INGRESS_DOMAIN}`) || r.host === INGRESS_DOMAIN
        )
        .map((r) => ({
          host: r.host,
          paths: r.http?.paths.map((p) => p.path) ?? ["/"],
          serviceName: r.http?.paths[0]?.backend.service.name ?? name,
        }));

      const deployments = deploymentsMap[ns] ?? [];
      const serviceName = hosts[0]?.serviceName ?? name;
      const deployment =
        deployments.find(
          (d) => d.metadata.name === name || d.metadata.name === serviceName
        ) ?? null;

      const pods = podsMap[ns] ?? [];
      const podStats = {
        total: pods.length,
        running: pods.filter((p) => p.status.phase === "Running").length,
        ready: pods.filter((p) =>
          p.status.conditions?.some(
            (c) => c.type === "Ready" && c.status === "True"
          )
        ).length,
        restarts: pods.reduce(
          (sum, p) =>
            sum +
            (p.status.containerStatuses?.reduce(
              (s, c) => s + c.restartCount,
              0
            ) ?? 0),
          0
        ),
      };

      const endpoints: EndpointResult[] = await Promise.all(
        hosts.map((h) => checkEndpoint(`https://${h.host}`))
      );

      return {
        name,
        namespace: ns,
        hosts,
        deployment: deployment
          ? {
              name: deployment.metadata.name,
              desired: deployment.spec.replicas ?? 1,
              available: deployment.status.availableReplicas ?? 0,
              ready: deployment.status.readyReplicas ?? 0,
            }
          : null,
        pods: podStats,
        endpoints,
        checkedAt: new Date().toISOString(),
      };
    })
  );

  return NextResponse.json({
    apps,
    fetchedAt: new Date().toISOString(),
    inCluster: relevant.length > 0 || allIngresses.length > 0,
  } satisfies HealthResponse);
}
