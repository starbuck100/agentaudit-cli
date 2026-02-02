const BASE_URL = "https://www.agentaudit.dev/api";

export interface Finding {
  ecap_id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  file_path?: string;
  line_number?: number;
  by_design?: boolean;
  component_type?: string;
}

export interface PackageResult {
  name: string;
  findings: Finding[];
  total: number;
  trustScore: number;
  error?: string;
}

export async function fetchFindings(packageName: string): Promise<PackageResult> {
  const url = `${BASE_URL}/findings?package=${encodeURIComponent(packageName)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return { name: packageName, findings: [], total: 0, trustScore: 0, error: `HTTP ${res.status}` };
    }

    const data = await res.json() as { findings: Finding[]; total: number };
    const trustScore = calculateTrustScore(data.findings);
    return { name: packageName, findings: data.findings, total: data.total, trustScore };
  } catch (e: any) {
    const msg = e.name === "AbortError" ? "Timeout" : e.message || "Unknown error";
    return { name: packageName, findings: [], total: 0, trustScore: -1, error: msg };
  }
}

function calculateTrustScore(findings: Finding[]): number {
  const penalties: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3 };
  const highRiskComponents = new Set(["hook", "mcp", "settings", "plugin"]);
  let total = 0;

  for (const f of findings) {
    if (f.by_design) continue;
    const base = penalties[f.severity] || 0;
    const multiplier = f.component_type && highRiskComponents.has(f.component_type) ? 1.2 : 1;
    total += base * multiplier;
  }

  return Math.max(0, Math.round(100 - total));
}
