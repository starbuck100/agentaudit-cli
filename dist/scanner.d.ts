import { type PackageResult } from "./api.js";
export interface ScanResult {
    configsFound: string[];
    packages: PackageResult[];
}
export declare function scan(extraPaths?: string[]): Promise<ScanResult>;
