import { existsSync, readFileSync } from "fs";

const TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const API_SERVER = "https://kubernetes.default.svc";

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

function isInCluster(): boolean {
  return existsSync(TOKEN_PATH);
}

function getToken(): string {
  return readFileSync(TOKEN_PATH, "utf-8").trim();
}

async function k8sFetch<T>(path: string): Promise<T | null> {
  if (!isInCluster()) return null;
  try {
    const res = await fetch(`${API_SERVER}${path}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cache: "no-store" as any,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listIngresses(): Promise<K8sIngress[]> {
  const data = await k8sFetch<{ items: K8sIngress[] }>(
    "/apis/networking.k8s.io/v1/ingresses"
  );
  return data?.items ?? [];
}

export async function listDeployments(namespace: string): Promise<K8sDeployment[]> {
  const data = await k8sFetch<{ items: K8sDeployment[] }>(
    `/apis/apps/v1/namespaces/${namespace}/deployments`
  );
  return data?.items ?? [];
}

export async function listPods(namespace: string): Promise<K8sPod[]> {
  const data = await k8sFetch<{ items: K8sPod[] }>(
    `/api/v1/namespaces/${namespace}/pods`
  );
  return data?.items ?? [];
}
