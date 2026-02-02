const BASE_URL = "https://www.agentaudit.dev/api";
export async function fetchFindings(packageName) {
    const url = `${BASE_URL}/findings?package=${encodeURIComponent(packageName)}`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
            return { name: packageName, findings: [], total: 0, trustScore: 0, error: `HTTP ${res.status}` };
        }
        const data = await res.json();
        const trustScore = calculateTrustScore(data.findings);
        return { name: packageName, findings: data.findings, total: data.total, trustScore };
    }
    catch (e) {
        const msg = e.name === "AbortError" ? "Timeout" : e.message || "Unknown error";
        return { name: packageName, findings: [], total: 0, trustScore: -1, error: msg };
    }
}
function calculateTrustScore(findings) {
    const penalties = { critical: 25, high: 15, medium: 8, low: 3 };
    const highRiskComponents = new Set(["hook", "mcp", "settings", "plugin"]);
    let total = 0;
    for (const f of findings) {
        if (f.by_design)
            continue;
        const base = penalties[f.severity] || 0;
        const multiplier = f.component_type && highRiskComponents.has(f.component_type) ? 1.2 : 1;
        total += base * multiplier;
    }
    return Math.max(0, Math.round(100 - total));
}
