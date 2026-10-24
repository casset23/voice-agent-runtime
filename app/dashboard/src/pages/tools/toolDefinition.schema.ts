// JSON Schema for Tool Definition edited in tools pages
// 注意：这是“工具定义”的 schema（name/description/parameters），不包含运行时统计字段
// 该 schema 用于 Monaco JSON 编辑器的校验与补全

export const TOOL_DEFINITION_SCHEMA_URI =
	"https://co-agent.local/schemas/tool-definition.json";

export const TOOL_DEFINITION_JSON_SCHEMA = {
	$id: TOOL_DEFINITION_SCHEMA_URI,
	$schema: "http://json-schema.org/draft-07/schema#",
	title: "ToolDefinition",
	description:
		"用于定义一个工具的 OpenAI Function Calling 格式。包含 type=function 和 function 对象。",
	type: "object",
	additionalProperties: false,
	required: ["type", "function"],
	properties: {
		type: {
			const: "function",
			description: "固定为 'function'",
		},
		function: {
			type: "object",
			title: "工具函数定义",
			description: "包含工具的名称、描述和参数定义",
			additionalProperties: false,
			required: ["name", "description", "parameters"],
			properties: {
				name: {
					type: "string",
					title: "工具名称",
					description:
						"工具的唯一名称，建议使用英文字母、数字、下划线或中划线（如 tool_weather）",
					minLength: 1,
					pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
					examples: ["tool_weather", "tool_music", "tool_datetime"],
				},
				description: {
					type: "string",
					title: "工具描述",
					description: "对工具用途的简要说明",
					minLength: 1,
				},
				parameters: {
					type: "object",
					title: "参数根对象",
					description: "必须为 JSON Schema 对象，包含功能列表于 properties 内",
					additionalProperties: false,
					required: ["type", "properties"],
					properties: {
						type: {
							const: "object",
							description: "固定为 'object'",
						},
						properties: {
							type: "object",
							title: "功能列表",
							description: "以功能名为键，每个功能为一个对象，描述该功能可用的参数",
							// 功能名约束
							propertyNames: {
								type: "string",
								pattern: "^[A-Za-z_][A-Za-z0-9_-]*$",
								description: "功能名（例如 now、forecast）",
							},
							additionalProperties: {
								$ref: "#/definitions/Action",
							},
						},
					},
				},
			},
		},
		// 兼容 ToolInfo 的统计字段（在创建/编辑时可省略）
		tool_calls: {
			type: "number",
			minimum: 0,
			description: "该工具历史被调用次数（只读/可选）",
		},
	},
	definitions: {
		FieldType: {
			type: "string",
			enum: ["string", "integer", "number", "boolean"],
			description: "参数基础类型",
		},
		ActionParam: {
			type: "object",
			title: "动作参数定义",
			additionalProperties: false,
			required: ["type", "description"],
			properties: {
				type: { $ref: "#/definitions/FieldType" },
				description: {
					type: "string",
					description: "该参数的说明",
					default: "",
				},
			},
			examples: [
				{ type: "string", description: "城市名称" },
				{ type: "integer", description: "第几天，1 表示今天" },
			],
		},
		Action: {
			type: "object",
			title: "功能（动作）定义",
			description:
				"每个功能包含固定的 type=object、描述、具体参数 properties 以及必填参数名数组 required",
			additionalProperties: false,
			required: ["type", "description", "properties", "required"],
			properties: {
				type: { const: "object", description: "固定为 'object'" },
				description: {
					type: "string",
					description: "该功能的说明",
					default: "",
				},
				properties: {
					type: "object",
					title: "参数字典",
					description: "以参数名为键",
					propertyNames: {
						type: "string",
						pattern: "^[A-Za-z_][A-Za-z0-9_-]*$",
						description: "参数名（例如 city、days）",
					},
					additionalProperties: { $ref: "#/definitions/ActionParam" },
				},
				required: {
					type: "array",
					title: "必填参数名",
					description:
						"参数名字符串数组。注意：schema 无法强制引用 properties 内已存在的键，请在编辑时保持一致。",
					items: { type: "string" },
					uniqueItems: true,
					default: [],
				},
			},
			examples: [
				{
					type: "object",
					description: "获取实时天气",
					properties: {
						city: { type: "string", description: "城市名称" },
					},
					required: [],
				},
			],
		},
	},
	examples: [
		{
			type: "function",
			function: {
				name: "tool_weather",
				description: "天气工具",
				parameters: {
					type: "object",
					properties: {
						now: {
							type: "object",
							description: "用户想要获取实时天气",
							properties: {
								city: { type: "string", description: "用户明确提到的城市名" },
							},
							required: [],
						},
						forecast: {
							type: "object",
							description: "用户想要获取天气预报",
							properties: {
								city: { type: "string", description: "用户明确提到的城市名" },
								days: {
									type: "integer",
									description: "第几天的预报。days=1 -> 今天",
								},
							},
							required: ["days"],
						},
					},
				},
			},
		},
	],
} as const;
