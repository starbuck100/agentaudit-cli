import chalk from "chalk";
import type { PackageInfo, CheckResult } from "./api.js";

export function scoreColor(score: number | null): string {
  if (score === null || score < 0) return chalk.gray("--");
  if (score >= 80) return chalk.green(String(score).padStart(2));
  if (score >= 50) return chalk.yellow(String(score).padStart(2));
  return chalk.red(String(score).padStart(2));
}

export function verdictIcon(result: string): string {
  switch (result?.toLowerCase()) {
    case "pass": case "safe": return chalk.green("✅");
    case "warn": return chalk.yellow("⚠️");
    case "fail": case "unsafe": return chalk.red("🔴");
    default: return chalk.gray("❓");
  }
}

export function verdictText(result: string): string {
  switch (result?.toLowerCase()) {
    case "pass": case "safe": return chalk.green("SAFE");
    case "warn": return chalk.yellow("WARN");
    case "fail": case "unsafe": return chalk.red("UNSAFE");
    default: return chalk.gray("UNKNOWN");
  }
}

export function formatPackageLine(name: string, pkg: PackageInfo | null, type?: string): string {
  if (!pkg) {
    return `  ${chalk.gray("❓")} ${chalk.gray("--")}  ${name.padEnd(28)} ${(type || "").padEnd(6)} ${chalk.gray("NOT AUDITED")}`;
  }
  const icon = verdictIcon(pkg.latest_result);
  const score = scoreColor(pkg.trust_score);
  const verdict = verdictText(pkg.latest_result);
  const findingsInfo = pkg.total_findings > 0 ? chalk.dim(` — ${pkg.total_findings} findings`) : "";
  return `  ${icon} ${score}  ${name.padEnd(28)} ${(pkg.scan_type || type || "").padEnd(6)} ${verdict}${findingsInfo}`;
}

export function formatPackageDetail(name: string, pkg: PackageInfo): string {
  const lines: string[] = [];
  const icon = verdictIcon(pkg.latest_result);
  lines.push(`${icon} ${chalk.bold(name)} ${chalk.dim(`(${pkg.scan_type || "unknown"})`)}`);
  lines.push(`   Trust Score:  ${scoreColor(pkg.trust_score)}/100`);
  lines.push(`   Risk Score:   ${pkg.latest_risk_score ?? "—"}/100`);
  lines.push(`   Verdict:      ${verdictText(pkg.latest_result)}`);
  lines.push(`   Findings:     ${pkg.total_findings} ${chalk.dim(`(from ${pkg.total_reports} audits)`)}`);
  if (pkg.source_url) lines.push(`   Source:       ${chalk.dim(pkg.source_url)}`);
  if (pkg.last_audited_at) {
    const d = new Date(pkg.last_audited_at);
    lines.push(`   Last audited: ${chalk.dim(d.toISOString().split("T")[0])}`);
  }
  lines.push(`   Details:      ${chalk.cyan(`https://agentaudit.dev/packages/${name}`)}`);
  return lines.join("\n");
}

export function formatSummary(total: number, passed: number, warned: number, failed: number, unknown: number): string {
  const parts: string[] = [];
  parts.push(chalk.bold(`${total} packages`));
  if (passed > 0) parts.push(chalk.green(`${passed} passed`));
  if (warned > 0) parts.push(chalk.yellow(`${warned} warnings`));
  if (failed > 0) parts.push(chalk.red(`${failed} failed`));
  if (unknown > 0) parts.push(chalk.gray(`${unknown} unknown`));
  return `\n${"━".repeat(50)}\n  ${parts.join(" · ")}\n`;
}

export function header(version: string): string {
  return `\n${chalk.bold("🔍 AgentAudit Scanner")} ${chalk.dim(`v${version}`)}\n`;
}
