export interface FoundPackage {
    name: string;
    source: string;
    configFile: string;
}
export interface ScanSources {
    mcp: boolean;
    npm: boolean;
    pip: boolean;
}
export declare function findPackages(sources: ScanSources, extraPaths?: string[]): Promise<FoundPackage[]>;
