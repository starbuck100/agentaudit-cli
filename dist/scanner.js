import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fetchFindings } from "./api.js";
const CONFIG_PATHS = [
    join(homedir(), ".config", "claude", "claude_desktop_config.json"),
    ".mcp.json",
    "mcp.json",
];
function extractPackageName(entry) {
    const args = entry.args || [];
    const cmd = entry.command || "";
    // npx <package> or npx -y <package>
    if (cmd === "npx" || cmd.endsWith("/npx")) {
        for (const arg of args) {
            if (!arg.startsWith("-"))
                return arg.replace(/@[\d^~>=<.*]+$/, "");
        }
    }
    // node <path> — extract from path
    if (cmd === "node" || cmd.endsWith("/node")) {
        for (const arg of args) {
            const match = arg.match(/node_modules\/([^/]+)/);
            if (match)
                return match[1];
        }
    }
    // uvx / pip packages
    if (cmd === "uvx" || cmd === "pipx") {
        for (const arg of args) {
            if (!arg.startsWith("-"))
                return arg;
        }
    }
    // docker — extract image name
    if (cmd === "docker" && args.includes("run")) {
        const runIdx = args.indexOf("run");
        const last = args[args.length - 1];
        if (last && !last.startsWith("-"))
            return last.split(":")[0];
    }
    return null;
}
export async function scan(extraPaths = []) {
    const allPaths = [...CONFIG_PATHS, ...extraPaths];
    const configsFound = [];
    const packageNames = new Set();
    for (const p of allPaths) {
        if (!existsSync(p))
            continue;
        configsFound.push(p);
        try {
            const raw = await readFile(p, "utf-8");
            const config = JSON.parse(raw);
            const servers = config.mcpServers || {};
            for (const [key, entry] of Object.entries(servers)) {
                const name = extractPackageName(entry);
                if (name)
                    packageNames.add(name);
                else
                    packageNames.add(key); // fallback to server key
            }
        }
        catch {
            // skip malformed files
        }
    }
    const packages = [];
    const promises = [...packageNames].map(async (name) => {
        const result = await fetchFindings(name);
        packages.push(result);
    });
    await Promise.all(promises);
    // Sort: failures first, then warnings, then passes
    packages.sort((a, b) => a.trustScore - b.trustScore);
    return { configsFound, packages };
}
