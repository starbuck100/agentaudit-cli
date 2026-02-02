export interface Finding {
    ecap_id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    file_path?: string;
    line_number?: number;
    by_design?: boolean;
    component_type?: string;
}
export interface PackageResult {
    name: string;
    findings: Finding[];
    total: number;
    trustScore: number;
    error?: string;
}
export declare function fetchFindings(packageName: string): Promise<PackageResult>;
