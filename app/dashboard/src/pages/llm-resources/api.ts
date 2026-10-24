import { apiClient } from "@/utils/api.ts";
import { atomWithRefresh } from "jotai/utils";

// ==================== 类型定义（与后端文档保持一致） ====================
export type CreateLlmDto = {
	displayName: string;
	model: string;
	isLocal: boolean;
	baseUrl?: string;
	apiKey?: string; // 仅创建 / 更新时提交，列表不会返回
	healthUrl?: string;
	maxTokens?: number;
	enabled?: boolean; // 后端默认 true
};

export type UpdateLlmDto = Partial<CreateLlmDto>;

export type LlmSummary = {
	id: string;
	displayName: string;
	model: string;
	isLocal: boolean;
	baseUrl?: string;
	healthUrl?: string;
	maxTokens?: number;
	enabled: boolean;
	lastStatus?: "online" | "offline" | "error";
	latencyMs?: number;
	lastCheckedAt?: string;
};

export type LlmHealth = {
	id: string;
	status: "online" | "offline" | "error";
	latencyMs?: number;
	checkedAt: string;
	error?: string;
};

// ==================== 基础 CRUD ====================
export async function listLlms() {
	return apiClient.get("/admin/api/llms").json<LlmSummary[]>();
}

export async function getLlm(id: string) {
	return apiClient.get(`/admin/api/llms/${id}`).json<LlmSummary>();
}

export async function createLlm(data: CreateLlmDto) {
	return apiClient.json(data).url(`/admin/api/llms`).post().json<LlmSummary>();
}

export async function updateLlm(id: string, data: UpdateLlmDto) {
	return apiClient
		.json(data)
		.url(`/admin/api/llms/${id}`)
		.put()
		.json<LlmSummary>();
}

export async function deleteLlm(id: string) {
	return apiClient
		.delete(`/admin/api/llms/${id}`)
		.json<{ deletedId: string }>();
}

export async function checkLlmHealth(id: string) {
	return apiClient.get(`/admin/api/llms/${id}/health`).json<LlmHealth>();
}

export const llmResourcesListAtom = atomWithRefresh(listLlms);
