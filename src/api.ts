const BASE = "https://www.agentaudit.dev/api";

export interface PackageInfo {
  slug: string;
  display_name: string;
  trust_score: number | null;
  latest_risk_score: number | null;
  latest_result: string;
  total_findings: number;
  total_reports: number;
  scan_type: string;
  source_url: string | null;
  first_audited_at: string | null;
  last_audited_at: string | null;
}

export interface CheckResult {
  found: boolean;
  pkg?: PackageInfo;
  error?: string;
}

async function apiFetch(url: string, opts?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { _error: res.status, _body: await res.json().catch(() => ({})) };
    return await res.json();
  } catch (e: any) {
    clearTimeout(timeout);
    throw new Error(e.name === "AbortError" ? "Request timed out" : e.message);
  }
}

export async function checkPackage(name: string): Promise<CheckResult> {
  try {
    const data = await apiFetch(`${BASE}/skills/${encodeURIComponent(name)}`);
    if (data._error === 404) return { found: false };
    if (data._error) return { found: false, error: `HTTP ${data._error}` };
    return { found: true, pkg: data };
  } catch (e: any) {
    return { found: false, error: e.message };
  }
}

export async function searchPackages(query: string, limit = 20): Promise<PackageInfo[]> {
  try {
    const data = await apiFetch(`${BASE}/skills?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (data._error) return [];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function getStats(): Promise<any> {
  try {
    const data = await apiFetch(`${BASE}/health`);
    if (data._error) return null;
    return data;
  } catch { return null; }
}