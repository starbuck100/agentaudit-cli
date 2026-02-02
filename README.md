# agentaudit

**Zero-install security scanner for AI agent packages.** Checks packages against the [AgentAudit](https://agentaudit.dev) registry for vulnerabilities and trust scores.

## Usage

### Quick Start
```bash
npx agentaudit scan
```

No install needed. Scans automatically for:
- `~/.config/claude/claude_desktop_config.json`
- `.mcp.json` (current directory)
- `mcp.json` (current directory)

### Commands

#### `scan` - Scan your local config files
```bash
npx agentaudit scan                           # Scan MCP configs only
npx agentaudit scan --all                     # Scan all package types  
npx agentaudit scan --npm --pip               # Include npm & Python
npx agentaudit scan --config ./my-config.json # Custom config paths
npx agentaudit scan --verbose                 # Detailed results
```

#### `check` - Check a specific package
```bash
npx agentaudit check crewai                   # Basic check
npx agentaudit check express --verbose        # Detailed info
npx agentaudit check mcp-fetch --json         # JSON output
```

#### `search` - Search the registry
```bash
npx agentaudit search mcp                     # Search for packages
npx agentaudit search crewai --limit 5        # Limit results
```

#### `stats` - Show database statistics
```bash
npx agentaudit stats                          # Registry status & stats
```

## Output Example

```
🔍 AgentAudit Scanner v2.0.0

  Found: ~/.config/claude/claude_desktop_config.json (3 mcp packages)

  Results:

  🔴 12  evil-package             mcp    UNSAFE — 7 findings
  ⚠️  52  sketchy-tool            mcp    WARN — 4 findings
  ✅ 97  mcp-server-fetch         mcp    SAFE — 1 findings

──────────────────────────────────────────────────
  3 packages · 1 passed · 1 warnings · 1 failed
```

## Trust Scores

| Range | Label | Meaning |
|-------|-------|---------|
| 70–100 | ✅ SAFE | Safe to use |
| 40–69 | ⚠️ WARN | Review before using |
| 0–39 | 🔴 UNSAFE | Do not use without remediation |

Exit codes:
- `0` - All packages passed or warnings only
- `1` - One or more packages failed (unsafe)  
- `2` - Package not found or API error

## How it works

1. **Discover packages** from MCP configs, package.json, requirements.txt
2. **Extract names** from `npx`, `node`, `uvx`, `docker`, `pip` commands
3. **Query registry** at `https://agentaudit.dev/api/skills/{package}`
4. **Calculate scores** from security findings (severity-weighted)
5. **Display results** with actionable recommendations

## License

MIT