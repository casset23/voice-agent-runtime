export type LlmStatus = 'online' | 'offline' | 'error';

export interface LlmResource {
    id: string;
    displayName: string;
    model: string;
    isLocal: boolean;
    baseUrl?: string;
    apiKey?: string;
    healthUrl?: string;
    maxTokens?: number;
    enabled: boolean;


    //运行状态(由健康检查更新)
    lastStatus?: LlmStatus;
    latencyMs?: number;
    lastCheckedAt?: string;
    lastError?: string;
}

export interface LlmHealth {
    id: string;
    status: LlmStatus;
    latencyMs?: number;
    checkedAt: string;
    error?: string;
}