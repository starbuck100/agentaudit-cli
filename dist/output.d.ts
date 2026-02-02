import type { PackageInfo } from "./api.js";
export declare function scoreColor(score: number | null): string;
export declare function verdictIcon(result: string): string;
export declare function verdictText(result: string): string;
export declare function formatPackageLine(name: string, pkg: PackageInfo | null, type?: string): string;
export declare function formatPackageDetail(name: string, pkg: PackageInfo): string;
export declare function formatSummary(total: number, passed: number, warned: number, failed: number, unknown: number): string;
export declare function header(version: string): string;
