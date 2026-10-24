// Create
export class CreateLlmDto {
    displayName!: string;
    model!: string;
    isLocal!: boolean;
    baseUrl?: string;
    apiKey?: string;
    healthUrl?: string;
    maxTokens?: number;
    enabled?: boolean; // Service 中默认 true
  }
  
  // Update
  export class UpdateLlmDto {
    displayName?: string;
    model?: string;
    isLocal?: boolean;
    baseUrl?: string;
    apiKey?: string;
    healthUrl?: string;
    maxTokens?: number;
    enabled?: boolean;
  }
  
  // Response（列表/详情对外形态，隐藏 apiKey）
  export class LlmSummary {
    id!: string;
    displayName!: string;
    model!: string;
    isLocal!: boolean;
    baseUrl?: string;
    healthUrl?: string;
    maxTokens?: number;
    enabled!: boolean;
    lastStatus?: 'online' | 'offline' | 'error';
    latencyMs?: number;
    lastCheckedAt?: string;
  }