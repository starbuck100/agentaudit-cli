import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
const CRED_PATH = join(homedir(), ".config", "agentaudit", "credentials.json");
export async function loadCredentials() {
    try {
        if (!existsSync(CRED_PATH))
            return null;
        const raw = await readFile(CRED_PATH, "utf-8");
        const data = JSON.parse(raw);
        if (data.api_key)
            return data;
        return null;
    }
    catch {
        return null;
    }
}
export async function saveCredentials(creds) {
    const dir = dirname(CRED_PATH);
    if (!existsSync(dir))
        await mkdir(dir, { recursive: true });
    await writeFile(CRED_PATH, JSON.stringify(creds, null, 2) + "\n");
}
export function credentialPath() { return CRED_PATH; }
