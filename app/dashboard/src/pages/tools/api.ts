/**
 * 集中了所有与工具相关的API调用
 */

import { apiClient } from "@/utils/api.ts";

// 基础响应接口
export interface ToolOverview {
	name: string;
	description: string;
	functionsCount: number;
}

// 工具详细信息接口（用于列表展示）
export interface ToolInfo {
	name: string;
	description: string;
	parameters?: {
		type: "object";
		properties: Record<
			string,
			{
				type: "object";
				description: string;
				properties: Record<string, { type: string; description: string }>;
				required: string[];
			}
		>;
	};
	tool_calls: number;
}

// OpenAI Function Calling 结构
export interface ToolDefinition {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, any>;
		};
	};
}

// 创建工具的请求体
export interface CreateToolDto {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, any>;
		};
	};
}

// 更新工具的请求体
export type UpdateToolDto = CreateToolDto;

// 创建/更新工具的响应
export interface ToolResponse {
	name: string;
	description: string;
	functionsCount: number;
	info_url: string;
}

// 删除工具的响应
export interface DeleteToolResponse {
	deletedTool: string;
}

// 校验响应
export interface ValidateResponse {
	ok: boolean;
	errors?: string[];
}

/**
 * 健康检查
 */
export async function healthCheck() {
	return apiClient.get("/health").json<{ status: string }>();
}

/**
 * 获取工具列表（概览）
 */
export async function listTools(): Promise<ToolOverview[]> {
	return apiClient.get("/admin/api/tools").json<ToolOverview[]>();
}

/**
 * 获取模板
 */
export async function getTemplate(
	type: "blank" | "weather" | "datetime" | "music" = "blank",
	name?: string,
): Promise<ToolDefinition> {
	const params = new URLSearchParams({ type });
	if (name) {
		params.append("name", name);
	}
	return apiClient
		.get(`/admin/api/tools/template?${params.toString()}`)
		.json<ToolDefinition>();
}

/**
 * 创建工具
 */
export async function createTool(toolDefinition: CreateToolDto) {
	return apiClient
		.json(toolDefinition)
		.url("/admin/api/tools")
		.post()
		.json<ToolResponse>();
}

/**
 * 获取工具完整定义
 */
export async function getToolDefinition(toolName: string) {
	return apiClient
		.get(`/admin/api/tools/defs/${toolName}`)
		.json<ToolDefinition>()
		.then((v) => v.function);
}

/**
 * 获取工具完整定义
 */
export async function updateTool(
	toolName: string,
	toolDefinition: UpdateToolDto,
) {
	return apiClient
		.json(toolDefinition)
		.url(`/admin/api/tools/${toolName}`)
		.put()
		.json<ToolResponse>();
}

/**
 * 删除工具
 */
export async function deleteTool(
	toolName: string,
): Promise<DeleteToolResponse> {
	return apiClient
		.delete(`/admin/api/tools/${toolName}`)
		.json<DeleteToolResponse>();
}

/**
 * 校验工具定义
 */
export async function validateTool(
	toolDefinition: ToolDefinition,
): Promise<ValidateResponse> {
	return apiClient
		.json(toolDefinition)
		.url("/admin/api/tools/validate")
		.post()
		.json<ValidateResponse>();
}

// 向后兼容的适配器函数
// 如果现有代码期望不同的数据格式，可以使用这些适配器

/**
 * 获取工具列表（适配原有接口格式）
 * 注意：这个函数将 ToolOverview 转换为原有的 ToolInfo 格式
 */
export async function listToolsCompat(): Promise<ToolInfo[]> {
	const overviews = await listTools();

	// 这里需要根据实际需要调整转换逻辑
	// 因为概览信息可能不包含完整的参数定义
	return overviews.map((overview) => ({
		name: overview.name,
		description: overview.description,
		tool_calls: overview.functionsCount,
	}));
}

/**
 * 创建工具（适配原有接口，接受字符串格式）
 */
export async function createToolCompat(
	toolDefinitionString: string,
): Promise<void> {
	try {
		const toolDefinition = JSON.parse(toolDefinitionString) as CreateToolDto;
		await createTool(toolDefinition);
	} catch (error) {
		throw new Error(`Failed to create tool: ${error}`);
	}
}

/**
 * 更新工具（适配原有接口，接受字符串格式）
 */
export async function updateToolCompat(
	toolName: string,
	toolDefinitionString: string,
): Promise<void> {
	try {
		const toolDefinition = JSON.parse(toolDefinitionString) as UpdateToolDto;
		await updateTool(toolName, toolDefinition);
	} catch (error) {
		throw new Error(`Failed to update tool: ${error}`);
	}
}

/**
 * 获取工具定义（适配原有接口，返回字符串格式）
 */
export async function getToolDefinitionCompat(
	toolName: string,
): Promise<string> {
	const definition = await getToolDefinition(toolName);
	return JSON.stringify(definition, null, 2);
}
