import MonacoEditor from "@monaco-editor/react";
import {
	Button,
	Dialog,
	Flex,
	Grid,
	Heading,
	Text,
	TextField,
	Switch,
	Badge,
	Callout,
	SegmentedControl,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { Info } from "lucide-react";
import { themeAtom } from "@/states/common.ts";
import {
	LLM_DEFINITION_JSON_SCHEMA,
	LLM_DEFINITION_SCHEMA_URI,
} from "./llmDefinition.schema.ts";
import styles from "./index.module.css";
import { getLlm } from "./api.ts";

interface EditLlmDialogProps {
	llmName: string;
	llmId: string;
	onEditLlm: (id: string, llmDefinition: string) => void;
}

// LLM 表单字段
interface LlmFormState {
	displayName: string;
	model: string;
	isLocal: boolean;
	baseUrl: string;
	healthUrl: string;
	maxTokens?: number;
	enabled: boolean;
	apiKey: string; // 仅提交使用，不会回显
}

function EditLlmDialog({ llmName, llmId, onEditLlm }: EditLlmDialogProps) {
	const theme = useAtomValue(themeAtom);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	// 模式 form / json
	const [mode, setMode] = useState<"form" | "json">("form");
	const [errorMsg, setErrorMsg] = useState("");

	const [form, setForm] = useState<LlmFormState>({
		displayName: "",
		model: "",
		isLocal: false,
		baseUrl: "",
		healthUrl: "",
		maxTokens: undefined,
		enabled: true,
		apiKey: "",
	});

	const [advancedJson, setAdvancedJson] = useState("{}\n");

	const buildDefinition = () => {
		const payload: any = {
			displayName: form.displayName.trim(),
			model: form.model.trim(),
			isLocal: form.isLocal,
			baseUrl: form.baseUrl.trim() || undefined,
			healthUrl: form.healthUrl.trim() || undefined,
			maxTokens: form.maxTokens ?? undefined,
			enabled: form.enabled,
		};
		if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
		return JSON.stringify(payload, null, 2);
	};

	const applyJsonToForm = (jsonStr: string) => {
		let obj: any;
		try {
			obj = JSON.parse(jsonStr);
		} catch {
			throw new Error("JSON 解析失败");
		}
		validate(obj);
		setForm((prev) => ({
			...prev,
			displayName: obj.displayName ?? "",
			model: obj.model ?? "",
			isLocal: !!obj.isLocal,
			baseUrl: obj.baseUrl ?? "",
			healthUrl: obj.healthUrl ?? "",
			maxTokens: typeof obj.maxTokens === "number" ? obj.maxTokens : undefined,
			enabled: obj.enabled !== false, // 默认 true
			apiKey: obj.apiKey, // 不回显
		}));
	};

	const validate = (obj: any) => {
		if (!obj || typeof obj !== "object") throw new Error("必须是对象");
		if (typeof obj.displayName !== "string")
			throw new Error("缺少 displayName");
		if (typeof obj.model !== "string") throw new Error("缺少 model");
		if (typeof obj.isLocal !== "boolean") throw new Error("缺少 isLocal");
		if (obj.baseUrl && typeof obj.baseUrl !== "string")
			throw new Error("baseUrl 应为字符串");
		if (obj.healthUrl && typeof obj.healthUrl !== "string")
			throw new Error("healthUrl 应为字符串");
		if (obj.maxTokens != null && typeof obj.maxTokens !== "number")
			throw new Error("maxTokens 应为数字");
		if (obj.enabled != null && typeof obj.enabled !== "boolean")
			throw new Error("enabled 应为布尔");
		return true;
	};

	const canSubmitForm = () => !!form.displayName.trim() && !!form.model.trim();

	const canSubmitJson = () => {
		try {
			validate(JSON.parse(advancedJson));
			return true;
		} catch {
			return false;
		}
	};

	const onModeChange = (next: "form" | "json") => {
		if (next === mode) return;
		if (next === "json") {
			setAdvancedJson(buildDefinition());
			setMode("json");
			setErrorMsg("");
			return;
		}
		// json -> form
		try {
			applyJsonToForm(advancedJson);
			setMode("form");
			setErrorMsg("");
		} catch (e: any) {
			setErrorMsg(`无法切换到表单模式：${e?.message ?? e}`);
		}
	};

	const handleEditClick = () => {
		if (mode === "form") {
			const json = buildDefinition();
			onEditLlm(llmId, json);
		} else {
			try {
				validate(JSON.parse(advancedJson));
				onEditLlm(llmId, advancedJson);
				setErrorMsg("");
			} catch (e: any) {
				setErrorMsg(`JSON 无效：${e?.message ?? e}`);
			}
		}
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			setErrorMsg("");
			loadLlmDefinition();
		}
	};

	const loadLlmDefinition = async () => {
		setIsLoading(true);
		try {
			const def = await getLlm(llmId);
			// getLlmResourceDefinition 返回 LlmSummary，没有 apiKey
			const json = JSON.stringify(def, null, 2);
			setAdvancedJson(json);
			try {
				applyJsonToForm(json);
				setMode("form");
			} catch (e: any) {
				setMode("json");
				setErrorMsg(`加载的资源定义无效：${e?.message ?? e}`);
			}
		} catch (error) {
			console.error("Failed to load LLM resource definition:", error);
			const fallback = JSON.stringify(
				{
					id: llmId,
					displayName: llmName,
					error: "加载失败",
				},
				null,
				2,
			);
			setAdvancedJson(fallback);
			setMode("json");
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
				maxWidth={mode === "json" ? "90vw" : undefined}
				className={styles.llmDialog}
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
				<Dialog.Title>编辑 LLM 资源: {llmName}</Dialog.Title>
				<Dialog.Description></Dialog.Description>

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
					<Flex
						direction="column"
						gap="4"
						style={{ overflowY: "auto", maxHeight: "60vh" }}
					>
						<Heading size="3" my="2">
							基本信息
						</Heading>
						<Grid columns="0fr 1fr" align="center" gap="2">
							<Text wrap="nowrap">显示名称</Text>
							<TextField.Root
								value={form.displayName}
								onChange={(e) =>
									setForm({ ...form, displayName: e.target.value })
								}
							/>
							<Text wrap="nowrap">模型</Text>
							<TextField.Root
								value={form.model}
								onChange={(e) => setForm({ ...form, model: e.target.value })}
							/>
							<Text wrap="nowrap">本地模型</Text>
							<Flex align="center" gap="2">
								<Switch
									checked={form.isLocal}
									onCheckedChange={(v) => setForm({ ...form, isLocal: !!v })}
								/>
								{form.isLocal && <Badge color="cyan">Local</Badge>}
							</Flex>
							<Text wrap="nowrap">启用</Text>
							<Switch
								checked={form.enabled}
								onCheckedChange={(v) => setForm({ ...form, enabled: !!v })}
							/>
						</Grid>

						<Heading size="3" my="2">
							连接配置
						</Heading>
						<Grid columns="0fr 1fr" align="baseline" gap="2">
							<Text wrap="nowrap">API 基础 URL</Text>
							<TextField.Root
								value={form.baseUrl}
								onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
							/>
							<Text wrap="nowrap">健康检查 URL</Text>
							<TextField.Root
								value={form.healthUrl}
								onChange={(e) =>
									setForm({ ...form, healthUrl: e.target.value })
								}
							/>
							<Text wrap="nowrap">API Key (更新时可填)</Text>
							<TextField.Root
								type="password"
								value={form.apiKey}
								onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
							/>
						</Grid>

						<Heading size="3" my="2">
							参数配置
						</Heading>
						<Grid columns="0fr 1fr" align="baseline" gap="2">
							<Text wrap="nowrap">最大 Tokens</Text>
							<TextField.Root
								type="number"
								value={form.maxTokens ?? ""}
								onChange={(e) =>
									setForm({
										...form,
										maxTokens: e.target.value
											? Number(e.target.value)
											: undefined,
									})
								}
							/>
						</Grid>
					</Flex>
				) : (
					<div
						className={styles.editorContainer}
						style={{ flex: 1, minHeight: 0 }}
					>
						{isLoading ? (
							<div className="flex items-center justify-center h-full">
								加载中...
							</div>
						) : (
							<MonacoEditor
								beforeMount={(monaco) => {
									monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
										validate: true,
										schemas: [
											{
												uri: LLM_DEFINITION_SCHEMA_URI,
												fileMatch: [`inmemory://model/llm-edit-${llmId}.json`],
												schema: LLM_DEFINITION_JSON_SCHEMA as any,
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
								path={`inmemory://model/llm-edit-${llmId}.json`}
							/>
						)}
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

export default EditLlmDialog;
