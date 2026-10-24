import MonacoEditor from "@monaco-editor/react";
import {
	Button,
	Callout,
	Dialog,
	Flex,
	Grid,
	Heading,
	IconButton,
	SegmentedControl,
	Select,
	Separator,
	Switch,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { Info, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { themeAtom } from "@/states/common.ts";
import { getToolDefinition } from "./api.ts";
import styles from "./index.module.css";
import {
	TOOL_DEFINITION_JSON_SCHEMA,
	TOOL_DEFINITION_SCHEMA_URI,
} from "./toolDefinition.schema";

interface EditToolDialogProps {
	toolName: string;
	onEditTool: (toolDefinition: string) => void;
}

type FieldType = "string" | "integer" | "number" | "boolean";

interface ParamField {
	key: string;
	type: FieldType;
	description: string;
	required: boolean;
}

interface ActionDef {
	key: string; // 功能名（parameters.properties 的键）
	description: string;
	fields: ParamField[];
}

function EditToolDialog({ toolName, onEditTool }: EditToolDialogProps) {
	const theme = useAtomValue(themeAtom);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	// 为本编辑器定义一个稳定的模型 URI，便于 schema 关联
	const modelUri = `inmemory://model/tool-definition-edit-${toolName}.json`;

	// 表单状态
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [actions, setActions] = useState<ActionDef[]>([]);

	// 错误提示
	const [errorMsg, setErrorMsg] = useState<string>("");

	// 模式切换
	const [mode, setMode] = useState<"form" | "json">("form");
	const [advancedJson, setAdvancedJson] = useState(
		JSON.stringify(
			{
				name: "",
				description: "",
				parameters: { type: "object", properties: {} },
			},
			null,
			2,
		),
	);

	const addAction = () => {
		setActions((prev) => [...prev, { key: "", description: "", fields: [] }]);
	};

	const removeAction = (idx: number) => {
		setActions((prev) => prev.filter((_, i) => i !== idx));
	};

	const updateAction = (idx: number, patch: Partial<ActionDef>) => {
		setActions((prev) =>
			prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
		);
	};

	const addField = (actionIdx: number) => {
		setActions((prev) =>
			prev.map((a, i) =>
				i === actionIdx
					? {
							...a,
							fields: [
								...a.fields,
								{ key: "", type: "string", description: "", required: false },
							],
						}
					: a,
			),
		);
	};

	const removeField = (actionIdx: number, fieldIdx: number) => {
		setActions((prev) =>
			prev.map((a, i) =>
				i === actionIdx
					? { ...a, fields: a.fields.filter((_, fi) => fi !== fieldIdx) }
					: a,
			),
		);
	};

	const updateField = (
		actionIdx: number,
		fieldIdx: number,
		patch: Partial<ParamField>,
	) => {
		setActions((prev) =>
			prev.map((a, i) => {
				if (i !== actionIdx) return a;
				return {
					...a,
					fields: a.fields.map((f, fi) =>
						fi === fieldIdx ? { ...f, ...patch } : f,
					),
				};
			}),
		);
	};

	const buildToolDefinition = () => {
		const parameters: any = { type: "object", properties: {} as any };
		for (const action of actions) {
			if (!action.key.trim()) continue;
			const actionProps: Record<string, { type: string; description: string }> =
				{};
			const required: string[] = [];
			for (const field of action.fields) {
				if (!field.key.trim()) continue;
				actionProps[field.key] = {
					type: field.type,
					description: field.description || "",
				};
				if (field.required) required.push(field.key);
			}
			(parameters.properties as any)[action.key] = {
				type: "object",
				description: action.description || "",
				properties: actionProps,
				required,
			};
		}
		const payload = {
			name: name.trim(),
			description: description.trim(),
			parameters,
		};
		return JSON.stringify(payload, null, 2);
	};

	const canSubmitForm = () => {
		if (!name.trim()) return false;
		for (const a of actions) {
			if (!a.key.trim()) return false;
			for (const f of a.fields) {
				if (!f.key.trim()) return false;
			}
		}
		return true;
	};

	// 校验 JSON -> Tool 对象
	const validateToolObject = (obj: any) => {
		if (!obj || typeof obj !== "object") throw new Error("必须是对象");
		if (typeof obj.name !== "string") throw new Error("缺少 name");
		if (typeof obj.description !== "string")
			throw new Error("缺少 description");
		if (!obj.parameters || typeof obj.parameters !== "object")
			throw new Error("缺少 parameters");
		if (obj.parameters.type !== "object")
			throw new Error("parameters.type 必须为 'object'");
		if (
			!obj.parameters.properties ||
			typeof obj.parameters.properties !== "object"
		)
			throw new Error("parameters.properties 必须为对象");
		for (const [actionKey, actionVal] of Object.entries<any>(
			obj.parameters.properties,
		)) {
			if (!actionKey) throw new Error("功能名不能为空");
			if (!actionVal || typeof actionVal !== "object")
				throw new Error(`功能 ${actionKey} 必须为对象`);
			if (actionVal.type !== "object")
				throw new Error(`功能 ${actionKey}.type 必须为 'object'`);
			if (typeof actionVal.description !== "string")
				throw new Error(`功能 ${actionKey}.description 必须为字符串`);
			if (!actionVal.properties || typeof actionVal.properties !== "object")
				throw new Error(`功能 ${actionKey}.properties 必须为对象`);
			if (!Array.isArray(actionVal.required))
				throw new Error(`功能 ${actionKey}.required 必须为数组`);
			for (const [fieldKey, fieldVal] of Object.entries<any>(
				actionVal.properties,
			)) {
				if (!fieldKey) throw new Error(`参数名不能为空 (${actionKey})`);
				if (!fieldVal || typeof fieldVal !== "object")
					throw new Error(`参数 ${actionKey}.${fieldKey} 必须为对象`);
				if (typeof fieldVal.type !== "string")
					throw new Error(`参数 ${actionKey}.${fieldKey}.type 必须为字符串`);
				if (typeof fieldVal.description !== "string")
					throw new Error(
						`参数 ${actionKey}.${fieldKey}.description 必须为字符串`,
					);
			}
		}
		return true;
	};

	const parseAndToForm = (jsonStr: string) => {
		let obj: any;
		try {
			obj = JSON.parse(jsonStr);
		} catch (_e) {
			throw new Error("JSON 解析失败");
		}
		validateToolObject(obj);
		// 映射到表单
		setName(obj.name ?? "");
		setDescription(obj.description ?? "");
		const nextActions: ActionDef[] = [];
		const props = obj.parameters?.properties ?? {};
		for (const [aKey, aVal] of Object.entries<any>(props)) {
			const required: string[] = Array.isArray(aVal.required)
				? aVal.required
				: [];
			const fields: ParamField[] = Object.entries<any>(
				aVal.properties ?? {},
			).map(([fKey, fVal]) => ({
				key: fKey,
				type: (fVal.type as FieldType) ?? "string",
				description: (fVal.description as string) ?? "",
				required: required.includes(fKey),
			}));
			nextActions.push({
				key: aKey,
				description: aVal.description ?? "",
				fields,
			});
		}
		setActions(nextActions);
	};

	const canSubmitJson = () => {
		try {
			parseAndToFormPreview(advancedJson);
			return true;
		} catch {
			return false;
		}
	};

	// 仅校验 JSON，不落地到状态
	const parseAndToFormPreview = (jsonStr: string) => {
		let obj: any;
		try {
			obj = JSON.parse(jsonStr);
		} catch {
			throw new Error("JSON 解析失败");
		}
		validateToolObject(obj);
		return obj;
	};

	const onModeChange = (next: "form" | "json") => {
		if (next === mode) return;
		if (next === "json") {
			// 表单 -> JSON
			setAdvancedJson(buildToolDefinition());
			setMode("json");
			setErrorMsg("");
			return;
		}
		// json -> 表单
		try {
			parseAndToForm(advancedJson);
			setMode("form");
			setErrorMsg("");
		} catch (e: any) {
			setErrorMsg(`无法切换到表单模式：${e?.message ?? e}`);
		}
	};

	const handleEditClick = () => {
		if (mode === "json") {
			try {
				parseAndToFormPreview(advancedJson);
				onEditTool(advancedJson);
				setErrorMsg("");
			} catch (e: any) {
				setErrorMsg(`JSON 无效：${e?.message ?? e}`);
			}
		} else {
			const def = buildToolDefinition();
			onEditTool(def);
			setErrorMsg("");
		}
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			setErrorMsg("");
			loadToolDefinition();
		}
	};

	const loadToolDefinition = async () => {
		setIsLoading(true);
		try {
			const definition = JSON.stringify(await getToolDefinition(toolName));
			setAdvancedJson(definition);
			try {
				parseAndToForm(definition);
				setErrorMsg("");
			} catch (e: any) {
				setErrorMsg(`加载的工具定义无效：${e?.message ?? e}`);
			}
		} catch (error) {
			console.error("Failed to load tool definition:", error);
			const fallback = JSON.stringify(
				{
					name: toolName,
					description: "Error loading tool definition",
					parameters: { type: "object", properties: {} },
				},
				null,
				2,
			);
			setAdvancedJson(fallback);
			try {
				parseAndToForm(fallback);
			} catch {
				// ignore
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
			<Dialog.Trigger>
				<Button variant="soft" size="1">
					编辑
				</Button>
			</Dialog.Trigger>
			<Dialog.Content
				className={styles.editToolDialog}
				maxWidth={mode === "json" ? "90vw" : undefined}
				style={
					mode === "json"
						? {
								width: "90vw",
								height: "90vh",
								display: "flex",
								flexDirection: "column",
							}
						: undefined
				}
			>
				<Dialog.Title>编辑工具: {toolName}</Dialog.Title>
				<Dialog.Description></Dialog.Description>

				{/* 错误提示 */}
				{errorMsg && (
					<Callout.Root color="red" role="alert" my="2">
						<Callout.Icon>
							<Info size={16} />
						</Callout.Icon>
						<Callout.Text>{errorMsg}</Callout.Text>
					</Callout.Root>
				)}

				<Flex align="center" justify="between" my="2">
					<Heading size="3">编辑模式</Heading>
					<SegmentedControl.Root
						value={mode}
						onValueChange={(v) => onModeChange(v as any)}
					>
						<SegmentedControl.Item value="form">表单模式</SegmentedControl.Item>
						<SegmentedControl.Item value="json">高级模式</SegmentedControl.Item>
					</SegmentedControl.Root>
				</Flex>

				{mode === "form" ? (
					<>
						<Heading size="3" my="4">
							基本信息
						</Heading>
						<Grid columns="0fr 1fr" align="baseline" gap="2">
							<Text wrap="nowrap">工具名称</Text>
							<TextField.Root
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="例如：tool_weather"
							/>
							<Text wrap="nowrap">描述</Text>
							<TextArea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="工具用途说明"
							/>
						</Grid>

						<Separator my="4" size="4" />

						<Flex align="center" justify="between" mb="2">
							<Heading size="3">功能列表</Heading>
							<IconButton
								size="1"
								variant="soft"
								onClick={addAction}
								aria-label="添加功能"
							>
								<Plus size={16} />
							</IconButton>
						</Flex>

						<Flex direction="column" gap="4" style={{ overflowY: "auto" }}>
							{actions.length === 0 && (
								<Text color="gray">尚未添加功能，点击右上角“+”添加。</Text>
							)}

							{actions.map((action, aIdx) => (
								<Flex
									key={aIdx}
									direction="column"
									gap="3"
									p="3"
									style={{
										border: "1px solid var(--gray-a6)",
										borderRadius: 8,
									}}
								>
									<Flex align="center" justify="between">
										<Heading size="2">功能 #{aIdx + 1}</Heading>
										<IconButton
											size="1"
											color="red"
											variant="soft"
											onClick={() => removeAction(aIdx)}
											aria-label="删除功能"
										>
											<Trash2 size={16} />
										</IconButton>
									</Flex>

									<Grid columns="0fr 1fr" align="baseline" gap="2">
										<Text wrap="nowrap">功能名称</Text>
										<TextField.Root
											value={action.key}
											onChange={(e) =>
												updateAction(aIdx, { key: e.target.value })
											}
											placeholder="例如：now、forecast"
										/>
										<Text wrap="nowrap">功能描述</Text>
										<TextArea
											value={action.description}
											onChange={(e) =>
												updateAction(aIdx, { description: e.target.value })
											}
											placeholder="该功能做什么"
										/>
									</Grid>

									<Flex align="center" justify="between" mt="2">
										<Text weight="medium">参数列表</Text>
										<IconButton
											size="1"
											variant="soft"
											onClick={() => addField(aIdx)}
											aria-label="添加参数"
										>
											<Plus size={16} />
										</IconButton>
									</Flex>

									<Flex direction="column" gap="3">
										{action.fields.length === 0 && (
											<Text color="gray">暂无参数。</Text>
										)}

										{action.fields.map((field, fIdx) => (
											<Flex
												key={fIdx}
												direction="column"
												gap="2"
												p="3"
												style={{
													border: "1px dashed var(--gray-a6)",
													borderRadius: 8,
												}}
											>
												<Flex align="center" justify="between">
													<Text>参数 #{fIdx + 1}</Text>
													<IconButton
														size="1"
														color="red"
														variant="soft"
														onClick={() => removeField(aIdx, fIdx)}
														aria-label="删除参数"
													>
														<Trash2 size={16} />
													</IconButton>
												</Flex>

												<Grid columns="0fr 1fr" align="baseline" gap="2">
													<Text wrap="nowrap">参数名称</Text>
													<TextField.Root
														value={field.key}
														onChange={(e) =>
															updateField(aIdx, fIdx, { key: e.target.value })
														}
														placeholder="例如：city、days"
													/>

													<Text wrap="nowrap">类型</Text>
													<Select.Root
														value={field.type}
														onValueChange={(v) =>
															updateField(aIdx, fIdx, { type: v as FieldType })
														}
													>
														<Select.Trigger />
														<Select.Content>
															<Select.Item value="string">string</Select.Item>
															<Select.Item value="integer">integer</Select.Item>
															<Select.Item value="number">number</Select.Item>
															<Select.Item value="boolean">boolean</Select.Item>
														</Select.Content>
													</Select.Root>

													<Text wrap="nowrap">必填</Text>
													<Switch
														checked={field.required}
														onCheckedChange={(checked) =>
															updateField(aIdx, fIdx, { required: !!checked })
														}
													/>

													<Text wrap="nowrap">描述</Text>
													<TextArea
														value={field.description}
														onChange={(e) =>
															updateField(aIdx, fIdx, {
																description: e.target.value,
															})
														}
														placeholder="参数含义"
													/>
												</Grid>
											</Flex>
										))}
									</Flex>
								</Flex>
							))}
						</Flex>
					</>
				) : (
					<div
						className={styles.editorContainer}
						style={{ flex: 1, minHeight: 0 }}
					>
						<MonacoEditor
							beforeMount={(monaco) => {
								monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
									validate: true,
									schemas: [
										{
											uri: TOOL_DEFINITION_SCHEMA_URI,
											fileMatch: [modelUri],
											schema: TOOL_DEFINITION_JSON_SCHEMA as any,
										},
									],
								});
							}}
							language="json"
							theme={theme === "dark" ? "vs-dark" : "light"}
							className={styles.editor}
							value={advancedJson}
							onChange={(v) => setAdvancedJson(v ?? "")}
							height="100%"
							options={{ minimap: { enabled: false }, automaticLayout: true }}
							path={modelUri}
						/>
					</div>
				)}

				<Flex justify="end" gap="2" className={styles.dialogActions}>
					<Dialog.Close>
						<Button variant="soft" size="2">
							取消
						</Button>
					</Dialog.Close>
					<Dialog.Close>
						<Button
							variant="solid"
							size="2"
							onClick={handleEditClick}
							disabled={
								isLoading ||
								(mode === "form" ? !canSubmitForm() : !canSubmitJson())
							}
						>
							保存修改
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export default EditToolDialog;
