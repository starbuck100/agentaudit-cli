interface Credentials {
    api_key: string;
    agent_name: string;
}
export declare function loadCredentials(): Promise<Credentials | null>;
export declare function saveCredentials(creds: Credentials): Promise<void>;
export declare function credentialPath(): string;
export {};
