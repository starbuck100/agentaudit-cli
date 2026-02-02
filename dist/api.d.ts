export interface PackageInfo {
    slug: string;
    display_name: string;
    trust_score: number | null;
    latest_risk_score: number | null;
    latest_result: string;
    total_findings: number;
    total_reports: number;
    scan_type: string;
    source_url: string | null;
    first_audited_at: string | null;
    last_audited_at: string | null;
}
export interface CheckResult {
    found: boolean;
    pkg?: PackageInfo;
    error?: string;
}
export declare function checkPackage(name: string): Promise<CheckResult>;
export declare function searchPackages(query: string, limit?: number): Promise<PackageInfo[]>;
export declare function registerAgent(agentName: string): Promise<{
    ok: boolean;
    api_key?: string;
    error?: string;
    existing?: boolean;
}>;
export declare function submitReport(apiKey: string, report: {
    package_name: string;
    risk_score: number;
    result: string;
    max_severity?: string;
    findings_count: number;
    findings?: any[];
    package_type?: string;
    source_url?: string;
}): Promise<{
    ok: boolean;
    report_id?: number;
    findings_created?: string[];
    error?: string;
}>;
export declare function getStats(): Promise<any>;
