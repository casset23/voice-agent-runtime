// LLM 资源定义 JSON Schema，用于 Monaco JSON 模式校验
// 说明：apiKey 在列表查询不会返回，仅在创建/更新提交，所以 schema 中仍标记为可选字符串。
export const LLM_DEFINITION_SCHEMA_URI =
	"inmemory://schema/llm-resource-definition.schema.json";

export const LLM_DEFINITION_JSON_SCHEMA = {
	$schema: "http://json-schema.org/draft-07/schema#",
	$id: LLM_DEFINITION_SCHEMA_URI,
	type: "object",
	additionalProperties: false,
	required: ["displayName", "model", "isLocal"],
	properties: {
		displayName: { type: "string", title: "显示名称" },
		model: { type: "string", title: "模型" },
		isLocal: { type: "boolean", title: "是否本地模型" },
		baseUrl: { type: "string", title: "基础 URL" },
		apiKey: {
			type: "string",
			title: "API Key",
			description: "仅在创建/更新时发送，后端不会回显",
		},
		healthUrl: { type: "string", title: "健康检查 URL" },
		maxTokens: { type: "number", title: "最大 Tokens" },
		enabled: { type: "boolean", title: "是否启用", default: true },
	},
} as const;
