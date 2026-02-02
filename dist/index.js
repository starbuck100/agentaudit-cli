#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { checkPackage, searchPackages, registerAgent, submitReport, getStats } from "./api.js";
import { findPackages } from "./scanner.js";
import { loadCredentials, saveCredentials, credentialPath } from "./credentials.js";
import { header, formatPackageLine, formatPackageDetail, formatSummary } from "./output.js";
const VERSION = "2.0.0";
const program = new Command()
    .name("agentaudit")
    .description("Security scanner for AI agent packages — check trust scores, find vulnerabilities, protect your setup.")
    .version(VERSION)
    .option("--no-color", "Disable colored output");
// ── check ──
program
    .command("check <package>")
    .description("Check a package's trust score and security status")
    .option("-v, --verbose", "Show detailed information")
    .option("--json", "Output as JSON")
    .addHelpText("after", `
Examples:
  agentaudit check crewai
  agentaudit check mcp-fetch --verbose
  agentaudit check express --json`)
    .action(async (name, opts) => {
    const spinner = ora(`Checking ${name}...`).start();
    const result = await checkPackage(name);
    spinner.stop();
    if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.found && result.pkg?.latest_result !== "unsafe" && result.pkg?.latest_result !== "fail" ? 0 : 1);
    }
    if (!result.found) {
        if (result.error) {
            console.log(chalk.red(`\n  ❌ Error: ${result.error}`));
        }
        else {
            console.log(`\n  ${chalk.gray("❓")} ${chalk.bold(name)} — ${chalk.gray("Not in AgentAudit database")}`);
            console.log(chalk.dim(`\n  This package hasn't been audited yet.`));
            console.log(chalk.dim(`  Submit an audit: ${chalk.cyan("agentaudit submit --help")}`));
            console.log(chalk.dim(`  Or browse: ${chalk.cyan(`https://agentaudit.dev`)}\n`));
        }
        process.exit(2);
    }
    const pkg = result.pkg;
    if (opts.verbose) {
        console.log(`\n${formatPackageDetail(name, pkg)}\n`);
    }
    else {
        console.log(`\n${formatPackageLine(name, pkg)}`);
        console.log(chalk.dim(`  → https://agentaudit.dev/packages/${name}\n`));
    }
    const exit = pkg.latest_result === "unsafe" || pkg.latest_result === "fail" ? 1 : 0;
    process.exit(exit);
});
// ── scan ──
program
    .command("scan")
    .description("Scan local config files for AI packages and check their security")
    .option("-c, --config <paths...>", "Additional MCP config file paths")
    .option("--npm", "Also scan package.json")
    .option("--pip", "Also scan requirements.txt / pyproject.toml")
    .option("--all", "Scan all detectable sources (MCP + npm + pip)")
    .option("-v, --verbose", "Show detailed results per package")
    .option("--json", "Output as JSON")
    .addHelpText("after", `
Examples:
  agentaudit scan
  agentaudit scan --all
  agentaudit scan --pip --npm
  agentaudit scan --config ~/.cursor/mcp.json
  agentaudit scan --all --verbose`)
    .action(async (opts) => {
    console.log(header(VERSION));
    const sources = {
        mcp: true, // always scan MCP
        npm: opts.all || opts.npm || false,
        pip: opts.all || opts.pip || false,
    };
    const spinner = ora("Scanning for packages...").start();
    const packages = await findPackages(sources, opts.config || []);
    spinner.stop();
    if (packages.length === 0) {
        console.log(chalk.yellow("  ⚠️  No packages found.\n"));
        console.log(chalk.dim("  Searched for:"));
        console.log(chalk.dim("    • MCP configs (Claude Desktop, .mcp.json)"));
        if (sources.npm)
            console.log(chalk.dim("    • package.json"));
        if (sources.pip)
            console.log(chalk.dim("    • requirements.txt / pyproject.toml"));
        console.log(chalk.dim(`\n  Try: agentaudit scan --all`));
        console.log(chalk.dim(`  Or check a specific package: agentaudit check <name>\n`));
        process.exit(0);
    }
    // Group by source
    const bySource = new Map();
    for (const p of packages) {
        const key = `${p.source}:${p.configFile}`;
        if (!bySource.has(key))
            bySource.set(key, []);
        bySource.get(key).push(p);
    }
    for (const [key, pkgs] of bySource) {
        const [source, file] = key.split(":");
        console.log(chalk.dim(`  Found: ${file} (${pkgs.length} ${source} packages)`));
    }
    console.log();
    // Check all packages
    const checkSpinner = ora(`Checking ${packages.length} packages...`).start();
    const results = [];
    await Promise.all(packages.map(async (p) => {
        const result = await checkPackage(p.name);
        results.push({ name: p.name, source: p.source, found: result.found, pkg: result.pkg || null });
    }));
    checkSpinner.stop();
    // Sort: unsafe first, then warn, then pass, then unknown
    const order = { unsafe: 0, fail: 0, warn: 1, pass: 2, safe: 2 };
    results.sort((a, b) => {
        const aOrd = a.found ? (order[a.pkg?.latest_result] ?? 3) : 4;
        const bOrd = b.found ? (order[b.pkg?.latest_result] ?? 3) : 4;
        return aOrd - bOrd;
    });
    if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
    }
    else {
        console.log(chalk.bold("  Results:\n"));
        for (const r of results) {
            if (opts.verbose && r.found) {
                console.log(formatPackageDetail(r.name, r.pkg));
                console.log();
            }
            else {
                console.log(formatPackageLine(r.name, r.pkg, r.source));
            }
        }
        let passed = 0, warned = 0, failed = 0, unknown = 0;
        for (const r of results) {
            if (!r.found) {
                unknown++;
                continue;
            }
            const v = r.pkg?.latest_result?.toLowerCase();
            if (v === "pass" || v === "safe")
                passed++;
            else if (v === "warn")
                warned++;
            else
                failed++;
        }
        console.log(formatSummary(results.length, passed, warned, failed, unknown));
    }
    const hasFailures = results.some(r => r.found && (r.pkg?.latest_result === "unsafe" || r.pkg?.latest_result === "fail"));
    process.exit(hasFailures ? 1 : 0);
});
// ── search ──
program
    .command("search <query>")
    .description("Search the AgentAudit package registry")
    .option("--json", "Output as JSON")
    .option("-l, --limit <n>", "Max results", "10")
    .addHelpText("after", `
Examples:
  agentaudit search mcp
  agentaudit search crewai --json`)
    .action(async (query, opts) => {
    const spinner = ora(`Searching "${query}"...`).start();
    const results = await searchPackages(query, parseInt(opts.limit));
    spinner.stop();
    if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
    }
    if (results.length === 0) {
        console.log(chalk.yellow(`\n  No packages matching "${query}" found.\n`));
        return;
    }
    console.log(chalk.bold(`\n  ${results.length} packages found:\n`));
    for (const pkg of results) {
        console.log(formatPackageLine(pkg.slug, pkg));
    }
    console.log();
});
// ── register ──
program
    .command("register <name>")
    .description("Register for an API key (free, required for submitting reports)")
    .addHelpText("after", `
Examples:
  agentaudit register my-scanner
  agentaudit register latent-audit-bot`)
    .action(async (name) => {
    const spinner = ora("Registering...").start();
    const result = await registerAgent(name);
    spinner.stop();
    if (!result.ok) {
        console.log(chalk.red(`\n  ❌ ${result.error}\n`));
        process.exit(2);
    }
    await saveCredentials({ api_key: result.api_key, agent_name: name });
    console.log(chalk.green(`\n  ✅ Registered as ${chalk.bold(name)}`));
    console.log(chalk.dim(`  API key saved to ${credentialPath()}`));
    console.log(chalk.dim(`  You can now submit reports with: agentaudit submit\n`));
});
// ── submit ──
program
    .command("submit")
    .description("Submit a security report with detailed findings")
    .requiredOption("-p, --package <name>", "Package name")
    .requiredOption("-r, --result <result>", "Result: pass, warn, fail")
    .requiredOption("-s, --score <n>", "Risk score 0-100 (0=safe, 100=dangerous)")
    .option("--severity <sev>", "Max severity: critical, high, medium, low, info")
    .option("--type <type>", "Package type: pip, npm, mcp, skill")
    .option("--source <url>", "Source repository URL")
    .option("--version <ver>", "Package version audited")
    .option("-f, --findings <file>", "JSON file with findings array (see --help for format)")
    .option("--finding <json...>", "Inline finding as JSON (repeatable)")
    .option("--api-key <key>", "API key (overrides saved credentials)")
    .addHelpText("after", `
Examples:
  # Simple report (no detailed findings)
  agentaudit submit -p phonemizer-fork -r pass -s 15

  # Report with findings from JSON file
  agentaudit submit -p evil-pkg -r fail -s 95 --severity critical -f findings.json

  # Report with inline findings
  agentaudit submit -p risky-mcp -r warn -s 65 --type mcp \\
    --finding '{"title":"Arbitrary code exec","severity":"critical","file":"index.js","line":42,"content":"eval(userInput)","description":"User input passed directly to eval()"}' \\
    --finding '{"title":"Data exfiltration","severity":"high","file":"helper.js","line":18,"content":"fetch(externalUrl, {body: env})","description":"Environment variables sent to external server"}'

Findings JSON format (array of objects):
  [
    {
      "title": "Finding title",           // required
      "severity": "critical",             // critical|high|medium|low|info
      "file": "src/index.js",            // affected file
      "line": 42,                         // line number
      "content": "eval(userInput)",       // the vulnerable code
      "description": "Detailed explanation of the vulnerability and its impact"
    }
  ]`)
    .action(async (opts) => {
    const apiKey = opts.apiKey || (await loadCredentials())?.api_key;
    if (!apiKey) {
        console.log(chalk.red(`\n  ❌ No API key found.`));
        console.log(chalk.dim(`  Register first: ${chalk.cyan("agentaudit register <your-name>")}\n`));
        process.exit(2);
    }
    // Parse findings
    let findings = [];
    if (opts.findings) {
        try {
            const { readFileSync } = await import("fs");
            const raw = readFileSync(opts.findings, "utf-8");
            findings = JSON.parse(raw);
            if (!Array.isArray(findings)) {
                console.log(chalk.red(`\n  ❌ Findings file must contain a JSON array\n`));
                process.exit(2);
            }
        }
        catch (e) {
            console.log(chalk.red(`\n  ❌ Could not read findings file: ${e.message}\n`));
            process.exit(2);
        }
    }
    if (opts.finding) {
        for (const f of opts.finding) {
            try {
                findings.push(JSON.parse(f));
            }
            catch {
                console.log(chalk.red(`\n  ❌ Invalid JSON in --finding: ${f}\n`));
                process.exit(2);
            }
        }
    }
    // Validate findings
    for (const f of findings) {
        if (!f.title && !f.name) {
            console.log(chalk.red(`\n  ❌ Each finding needs at least a "title" field\n`));
            process.exit(2);
        }
    }
    // Auto-detect severity from findings if not set
    const sevOrder = ["critical", "high", "medium", "low", "info"];
    if (!opts.severity && findings.length > 0) {
        let maxSev = "info";
        for (const f of findings) {
            const s = (f.severity || "info").toLowerCase();
            if (sevOrder.indexOf(s) < sevOrder.indexOf(maxSev))
                maxSev = s;
        }
        opts.severity = maxSev;
    }
    const spinner = ora(`Submitting report for ${opts.package} (${findings.length} findings)...`).start();
    const result = await submitReport(apiKey, {
        package_name: opts.package,
        risk_score: parseInt(opts.score),
        result: opts.result,
        max_severity: opts.severity,
        findings_count: findings.length,
        findings: findings.map(f => ({
            title: f.title || f.name,
            severity: f.severity || "info",
            file: f.file || f.file_path || undefined,
            line_number: f.line || f.line_number || undefined,
            line_content: f.content || f.line_content || undefined,
            description: f.description || undefined,
            pattern_id: f.pattern_id || undefined,
        })),
        package_type: opts.type,
        source_url: opts.source,
        package_version: opts.version,
    });
    spinner.stop();
    if (!result.ok) {
        console.log(chalk.red(`\n  ❌ ${result.error}\n`));
        process.exit(2);
    }
    console.log(chalk.green(`\n  ✅ Report submitted for ${chalk.bold(opts.package)}`));
    console.log(chalk.dim(`  Report ID: ${result.report_id}`));
    if (findings.length > 0) {
        console.log(chalk.dim(`  Findings:  ${findings.length}`));
        for (const f of findings) {
            const sev = (f.severity || "info").toLowerCase();
            const sevColor = sev === "critical" ? chalk.red : sev === "high" ? chalk.yellow : chalk.dim;
            console.log(`    ${sevColor(`[${sev.toUpperCase()}]`)} ${f.title || f.name}${f.file ? chalk.dim(` (${f.file}${f.line ? `:${f.line}` : ""})`) : ""}`);
        }
    }
    console.log(chalk.dim(`  View: https://agentaudit.dev/packages/${opts.package}\n`));
});
// ── stats ──
program
    .command("stats")
    .description("Show AgentAudit database statistics")
    .action(async () => {
    const spinner = ora("Fetching stats...").start();
    const data = await getStats();
    spinner.stop();
    if (!data) {
        console.log(chalk.red("\n  ❌ Could not reach AgentAudit API\n"));
        process.exit(2);
    }
    console.log(chalk.bold("\n  📊 AgentAudit Registry\n"));
    console.log(`  Packages audited:  ${chalk.cyan(data.db?.skills ?? "?")}`);
    console.log(`  Total findings:    ${chalk.cyan(data.db?.findings ?? "?")}`);
    console.log(`  Registered agents: ${chalk.cyan(data.db?.agents ?? "?")}`);
    console.log(`  Status:            ${data.status === "ok" ? chalk.green("Online") : chalk.red(data.status)}`);
    console.log(chalk.dim(`\n  https://agentaudit.dev\n`));
});
program.parse();
