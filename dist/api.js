const BASE = "https://www.agentaudit.dev/api";
async function apiFetch(url, opts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok)
            return { _error: res.status, _body: await res.json().catch(() => ({})) };
        return await res.json();
    }
    catch (e) {
        clearTimeout(timeout);
        throw new Error(e.name === "AbortError" ? "Request timed out" : e.message);
    }
}
export async function checkPackage(name) {
    try {
        const data = await apiFetch(`${BASE}/skills/${encodeURIComponent(name)}`);
        if (data._error === 404)
            return { found: false };
        if (data._error)
            return { found: false, error: `HTTP ${data._error}` };
        return { found: true, pkg: data };
    }
    catch (e) {
        return { found: false, error: e.message };
    }
}
export async function searchPackages(query, limit = 20) {
    try {
        const data = await apiFetch(`${BASE}/skills?q=${encodeURIComponent(query)}&limit=${limit}`);
        if (data._error)
            return [];
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
}
export async function registerAgent(agentName) {
    try {
        const data = await apiFetch(`${BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent_name: agentName }),
        });
        if (data._error)
            return { ok: false, error: data._body?.error || `HTTP ${data._error}` };
        return { ok: true, api_key: data.api_key, existing: data.existing };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
export async function submitReport(apiKey, report) {
    try {
        const data = await apiFetch(`${BASE}/reports`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(report),
        });
        if (data._error)
            return { ok: false, error: data._body?.error || `HTTP ${data._error}` };
        return { ok: true, report_id: data.report_id, findings_created: data.findings_created };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
export async function getStats() {
    try {
        const data = await apiFetch(`${BASE}/health`);
        if (data._error)
            return null;
        return data;
    }
    catch {
        return null;
    }
}
