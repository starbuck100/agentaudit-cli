# agentaudit

**Zero-install MCP security scanner.** Checks your local MCP config packages against the [AgentAudit](https://agentaudit.dev) registry.

## Usage

```bash
npx agentaudit scan
```

No install needed. Scans automatically for:

- `~/.config/claude/claude_desktop_config.json`
- `.mcp.json` (current directory)
- `mcp.json` (current directory)

### Custom config paths

```bash
npx agentaudit scan --config ./my-config.json /other/path.json
```

## Output

```
🔍 AgentAudit Scanner

📂 Configs found: ~/.config/claude/claude_desktop_config.json

Found 3 package(s):

  ✅ PASS mcp-server-fetch — Trust Score: 97/100 (1 finding)
  ⚠️ WARN sketchy-tool    — Trust Score: 52/100 (4 findings)
       └─ [HIGH] Unsanitized shell execution
  🔴 FAIL evil-package     — Trust Score: 12/100 (7 findings)
       └─ [CRIT] Remote code execution via postinstall
       └─ [CRIT] Credential exfiltration to external server

─── Summary ───────────────────────────
  ✅ 1 passed
  ⚠️  1 warnings
  🔴 1 failed
───────────────────────────────────────
```

## Trust Score

| Range | Label | Meaning |
|-------|-------|---------|
| 70–100 | ✅ PASS | Safe to use |
| 40–69 | ⚠️ WARN | Review before using |
| 0–39 | 🔴 FAIL | Do not use without remediation |

Exit code `1` if any package fails.

## How it works

1. Finds MCP config files with `mcpServers` entries
2. Extracts package names from `npx`, `node`, `uvx`, `docker` commands
3. Queries `GET https://agentaudit.dev/api/findings?package={name}` for each
4. Calculates Trust Score from findings (severity-weighted penalties)
5. Displays results with actionable output

## License

MIT
