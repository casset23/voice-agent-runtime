健康检查
GET /health
用途：服务存活检查
响应：{ "status": "ok" }


列表（概览）
GET /admin/api/tools
用途：列表页卡片展示
响应（示例，工具概览而非完整定义）:
[{ "name": "tool_weather", "description": "…", "functionsCount": 2 }]


创建流程用
GET /admin/api/tools/template?type=blank&name=tool_new
用途：新建页预填“默认 JSON 骨架”
参数：
type: 模板类型（建议：blank | weather | datetime | music）
name: 预设名称（可选）
响应（OpenAI Function Calling 结构，示例）:
{ "type": "function", "function": { "name": "tool_new", "description": "", "parameters": { "type": "object", "properties": { "default": { "type": "object", "description": "…", "properties": { "example_param": { "type": "string", "description": "…" } }, "required": [] } } } } }



POST /admin/api/tools
用途：提交“创建工具”（两种模式最终都提交完整 JSON）
请求体（CreateToolDto，示例）:
{ "type": "function", "function": { "name": "tool_weather", "description": "【显示名：…】业务描述…", "parameters": { "type": "object", "properties": { "now": { "type": "object", "description": "…", "properties": { "city": { "type": "string", "description": "…" } }, "required": [] } } } } }
响应（附带专属读取 URL）:
{ "name": "tool_weather", "description": "…", "functionsCount": 2, "info_url": "/admin/api/tools/defs/tool_weather" }



编辑/更新流程用
GET /admin/api/tools/defs/:name
用途：编辑页预填“完整定义 JSON”（JSON/表单两种模式都基于它）
响应：完整 OpenAI Function Calling 结构（即创建时保存的原始 JSON）


PUT /admin/api/tools/:name
用途：更新工具（两种模式最终都提交完整 JSON）
请求体（UpdateToolDto，同创建体结构）
响应（附带最新专属 URL，兼容改名）:
{ "name": "tool_weather", "description": "…", "functionsCount": 2, "info_url": "/admin/api/tools/defs/tool_weather" }



删除
DELETE /admin/api/tools/:name
用途：删除工具
响应：{ "deletedTool": "tool_weather" }
可选（推荐，便于前端保存前校验）



POST /admin/api/tools/validate
用途：保存前做轻量校验（字段规范、必填、类型等）
请求体：完整工具 JSON
响应：{ "ok": true } 或 { "ok": false, "errors": [ "…" ] }


前端集成建议
新建页：
先 GET /admin/api/tools/template 预填 → JSON/表单任意编辑 → POST /admin/api/tools
保存成功后，持久化响应中的 info_url，后续编辑直接用它 GET 预填
编辑页：
直接 GET /admin/api/tools/defs/:name 预填 → JSON/表单任意编辑 → PUT /admin/api/tools/:name
若允许改名，成功响应的 name 和 info_url 需更新到本地状态
JSON 模式与表单模式都以“同一份编辑态 JSON”为数据源；切换时保持同步
简要总结
必接：template、create、defs、update、list、delete
创建/更新响应都会返回 info_url，前端保存起来用于后续读取完整定义
可选接：validate，提升数据规范与避免保存失败