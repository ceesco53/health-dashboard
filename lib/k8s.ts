import https from "https";
import { existsSync, readFileSync } from "fs";

const TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const CA_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";

export interface K8sIngress {
  metadata: { name: string; namespace: string };
  spec: {
    rules?: Array<{
      host: string;
      http?: {
        paths: Array<{
          path: string;
          backend: { service: { name: string; port: { number: number } } };
        }>;
      };
    }>;
  };
}

export interface K8sDeployment {
  metadata: { name: string; namespace: string };
  spec: { replicas: number };
  status: {
    replicas?: number;
    availableReplicas?: number;
    readyReplicas?: number;
    updatedReplicas?: number;
  };
}

export interface K8sPod {
  metadata: { name: string; namespace: string };
  status: {
    phase: string;
    conditions?: Array<{ type: string; status: string }>;
    containerStatuses?: Array<{ ready: boolean; restartCount: number }>;
  };
}

export function isInCluster(): boolean {
  return existsSync(TOKEN_PATH);
}

function k8sRequest<T>(path: string): Promise<T | null> {
  return new Promise((resolve) => {
    if (!isInCluster()) {
      resolve(null);
      return;
    }
    try {
      const host = process.env.KUBERNETES_SERVICE_HOST ?? "kubernetes.default.svc";
      const port = Number(process.env.KUBERNETES_SERVICE_PORT ?? 443);
      const token = readFileSync(TOKEN_PATH, "utf-8").trim();
      const ca = readFileSync(CA_PATH);

      const req = https.request(
        {
          hostname: host,
          port,
          path,
          method: "GET",
          ca,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => {
            if (res.statusCode && res.statusCode < 400) {
              try {
                resolve(JSON.parse(body) as T);
              } catch {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.setTimeout(10_000, () => { req.destroy(); resolve(null); });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

export async function listIngresses(): Promise<K8sIngress[]> {
  const data = await k8sRequest<{ items: K8sIngress[] }>(
    "/apis/networking.k8s.io/v1/ingresses"
  );
  return data?.items ?? [];
}

export async function listDeployments(namespace: string): Promise<K8sDeployment[]> {
  const data = await k8sRequest<{ items: K8sDeployment[] }>(
    `/apis/apps/v1/namespaces/${namespace}/deployments`
  );
  return data?.items ?? [];
}

export async function listPods(namespace: string): Promise<K8sPod[]> {
  const data = await k8sRequest<{ items: K8sPod[] }>(
    `/api/v1/namespaces/${namespace}/pods`
  );
  return data?.items ?? [];
}
