#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scan } from "./scanner.js";
const program = new Command();
program
    .name("agentaudit")
    .description("Zero-install MCP security scanner — checks your MCP packages against the AgentAudit registry")
    .version("1.0.0");
program
    .command("scan")
    .description("Scan local MCP config files and check packages against the AgentAudit registry")
    .option("-c, --config <paths...>", "Additional config file paths to scan")
    .action(async (opts) => {
    console.log(chalk.bold("\n🔍 AgentAudit Scanner\n"));
    const spinner = ora("Scanning MCP configurations...").start();
    try {
        const result = await scan(opts.config || []);
        spinner.stop();
        if (result.configsFound.length === 0) {
            console.log(chalk.yellow("⚠️  No MCP config files found. Searched:"));
            console.log(chalk.dim("   ~/.config/claude/claude_desktop_config.json"));
            console.log(chalk.dim("   .mcp.json"));
            console.log(chalk.dim("   mcp.json"));
            console.log(chalk.dim("\nUse --config <path> to specify a custom config file.\n"));
            process.exit(0);
        }
        console.log(chalk.dim(`📂 Configs found: ${result.configsFound.join(", ")}\n`));
        if (result.packages.length === 0) {
            console.log(chalk.yellow("No packages found in config files.\n"));
            process.exit(0);
        }
        console.log(chalk.bold(`Found ${result.packages.length} package(s):\n`));
        let hasFailure = false;
        for (const pkg of result.packages) {
            printPackageResult(pkg);
            if (pkg.trustScore >= 0 && pkg.trustScore < 40)
                hasFailure = true;
        }
        // Summary
        const passed = result.packages.filter(p => p.trustScore >= 70).length;
        const warned = result.packages.filter(p => p.trustScore >= 40 && p.trustScore < 70).length;
        const failed = result.packages.filter(p => p.trustScore >= 0 && p.trustScore < 40).length;
        const errors = result.packages.filter(p => p.trustScore < 0).length;
        console.log(chalk.bold("\n─── Summary ───────────────────────────"));
        if (passed > 0)
            console.log(chalk.green(`  ✅ ${passed} passed`));
        if (warned > 0)
            console.log(chalk.yellow(`  ⚠️  ${warned} warnings`));
        if (failed > 0)
            console.log(chalk.red(`  🔴 ${failed} failed`));
        if (errors > 0)
            console.log(chalk.dim(`  ❓ ${errors} could not be checked`));
        console.log(chalk.dim("───────────────────────────────────────\n"));
        if (hasFailure)
            process.exit(1);
    }
    catch (err) {
        spinner.fail("Scan failed");
        console.error(chalk.red(err.message));
        process.exit(1);
    }
});
function printPackageResult(pkg) {
    if (pkg.error) {
        console.log(chalk.dim(`  ❓ ${chalk.bold(pkg.name)} — ${chalk.italic("API unreachable:")} ${pkg.error}`));
        return;
    }
    const score = pkg.trustScore;
    let icon, label, colorFn;
    if (score >= 70) {
        icon = "✅";
        label = "PASS";
        colorFn = chalk.green;
    }
    else if (score >= 40) {
        icon = "⚠️";
        label = "WARN";
        colorFn = chalk.yellow;
    }
    else {
        icon = "🔴";
        label = "FAIL";
        colorFn = chalk.red;
    }
    const scoreStr = score === 100 ? "100" : String(score).padStart(2);
    console.log(`  ${icon} ${colorFn(label)} ${chalk.bold(pkg.name)} — Trust Score: ${colorFn(`${scoreStr}/100`)}` +
        (pkg.total === 0 ? chalk.dim(" (no findings)") : ` (${pkg.total} finding${pkg.total > 1 ? "s" : ""})`));
    // Show critical/high findings inline
    const critical = pkg.findings.filter(f => (f.severity === "critical" || f.severity === "high") && !f.by_design);
    for (const f of critical.slice(0, 5)) {
        const sev = f.severity === "critical" ? chalk.red.bold("CRIT") : chalk.red("HIGH");
        console.log(chalk.dim(`       └─ [${sev}${chalk.dim("]")} ${f.title}`));
    }
    if (critical.length > 5) {
        console.log(chalk.dim(`       └─ ... and ${critical.length - 5} more`));
    }
}
program.parse();
