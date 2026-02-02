import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const MCP_PATHS = [
    join(homedir(), ".config", "claude", "claude_desktop_config.json"),
    ".mcp.json",
    "mcp.json",
];
function extractMcpPackage(key, entry) {
    const args = entry.args || [];
    const cmd = entry.command || "";
    if (cmd === "npx" || cmd.endsWith("/npx")) {
        for (const arg of args) {
            if (!arg.startsWith("-"))
                return arg.replace(/@[\d^~>=<.*]+$/, "");
        }
    }
    if (cmd === "node" || cmd.endsWith("/node")) {
        for (const arg of args) {
            const m = arg.match(/node_modules\/([^/]+)/);
            if (m)
                return m[1];
        }
    }
    if (cmd === "uvx" || cmd === "pipx") {
        for (const arg of args) {
            if (!arg.startsWith("-"))
                return arg;
        }
    }
    if (cmd === "docker" && args.includes("run")) {
        const last = args[args.length - 1];
        if (last && !last.startsWith("-"))
            return last.split(":")[0];
    }
    return null;
}
export async function findPackages(sources, extraPaths = []) {
    const found = [];
    const seen = new Set();
    const add = (name, source, file) => {
        const key = `${name}::${source}`;
        if (seen.has(key))
            return;
        seen.add(key);
        found.push({ name, source, configFile: file });
    };
    // MCP configs
    if (sources.mcp) {
        const paths = [...MCP_PATHS, ...extraPaths];
        for (const p of paths) {
            if (!existsSync(p))
                continue;
            try {
                const raw = await readFile(p, "utf-8");
                const config = JSON.parse(raw);
                const servers = config.mcpServers || {};
                for (const [key, entry] of Object.entries(servers)) {
                    const name = extractMcpPackage(key, entry);
                    add(name || key, "mcp", p);
                }
            }
            catch { }
        }
    }
    // package.json
    if (sources.npm) {
        const pjPath = "package.json";
        if (existsSync(pjPath)) {
            try {
                const raw = await readFile(pjPath, "utf-8");
                const pj = JSON.parse(raw);
                for (const name of Object.keys(pj.dependencies || {}))
                    add(name, "npm", pjPath);
                for (const name of Object.keys(pj.devDependencies || {}))
                    add(name, "npm", pjPath);
            }
            catch { }
        }
    }
    // requirements.txt / pyproject.toml
    if (sources.pip) {
        // requirements.txt
        for (const reqFile of ["requirements.txt", "requirements-dev.txt", "requirements_dev.txt"]) {
            if (!existsSync(reqFile))
                continue;
            try {
                const raw = await readFile(reqFile, "utf-8");
                for (const line of raw.split("\n")) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-"))
                        continue;
                    const name = trimmed.split(/[>=<!\[;]/)[0].trim();
                    if (name)
                        add(name, "pip", reqFile);
                }
            }
            catch { }
        }
        // pyproject.toml (basic parser)
        if (existsSync("pyproject.toml")) {
            try {
                const raw = await readFile("pyproject.toml", "utf-8");
                const depMatch = raw.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
                if (depMatch) {
                    for (const m of depMatch[1].matchAll(/"([^">=<!\[]+)/g)) {
                        const name = m[1].trim();
                        if (name)
                            add(name, "pip", "pyproject.toml");
                    }
                }
            }
            catch { }
        }
    }
    return found;
}
