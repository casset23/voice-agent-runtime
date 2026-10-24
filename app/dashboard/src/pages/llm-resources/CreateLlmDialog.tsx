import {
	Badge,
	Button,
	Dialog,
	Flex,
	Grid,
	Heading,
	Text,
	TextField,
	Switch,
	SegmentedControl,
	Callout,
} from "@radix-ui/themes";
import { Plus, Info } from "lucide-react";
import styles from "./index.module.css";
import MonacoEditor from "@monaco-editor/react";
import { useAtomValue } from "jotai";
import { themeAtom } from "@/states/common.ts";
import {
	LLM_DEFINITION_JSON_SCHEMA,
	LLM_DEFINITION_SCHEMA_URI,
} from "./llmDefinition.schema.ts";

interface CreateLlmDialogProps {
	onCreateLlm: (llmDefinition: string) => void;
}

import { useState } from "react";

function CreateLlmDialog({ onCreateLlm }: CreateLlmDialogProps) {
	const theme = useAtomValue(themeAtom);
	// 表单状态
	const [displayName, setDisplayName] = useState("新 LLM 资源");
	const [model, setModel] = useState("gpt-4o");
	const [isLocal, setIsLocal] = useState(false);
	const [baseUrl, setBaseUrl] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [healthUrl, setHealthUrl] = useState("");
	const [maxTokens, setMaxTokens] = useState<number | undefined>(4096);
	const [enabled, setEnabled] = useState(true);

	// 模式 & 错误
	const [mode, setMode] = useState<"form" | "json">("form");
	const [errorMsg, setErrorMsg] = useState("");
	const [advancedJson, setAdvancedJson] = useState("{}\n");

	const buildJson = () =>
		JSON.stringify(
			{
				displayName: displayName.trim(),
				model: model.trim(),
				isLocal,
				baseUrl: baseUrl.trim() || undefined,
				apiKey: apiKey.trim() || undefined,
				healthUrl: healthUrl.trim() || undefined,
				maxTokens: maxTokens ?? undefined,
				enabled,
			},
			null,
			2,
		);

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

	const jsonToForm = (jsonStr: string) => {
		let obj: any;
		try {
			obj = JSON.parse(jsonStr);
		} catch {
			throw new Error("JSON 解析失败");
		}
		validate(obj);
		setDisplayName(obj.displayName ?? "");
		setModel(obj.model ?? "");
		setIsLocal(!!obj.isLocal);
		setBaseUrl(obj.baseUrl ?? "");
		setApiKey(""); // 不回显
		setHealthUrl(obj.healthUrl ?? "");
		setMaxTokens(typeof obj.maxTokens === "number" ? obj.maxTokens : undefined);
		setEnabled(obj.enabled !== false);
	};

	const canSubmitForm = () => !!displayName.trim() && !!model.trim();
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
			setAdvancedJson(buildJson());
			setMode("json");
			setErrorMsg("");
			return;
		}
		try {
			jsonToForm(advancedJson);
			setMode("form");
			setErrorMsg("");
		} catch (e: any) {
			setErrorMsg(`无法切换到表单模式：${e?.message ?? e}`);
		}
	};

	const handleCreateClick = () => {
		if (mode === "form") {
			onCreateLlm(buildJson());
		} else {
			try {
				validate(JSON.parse(advancedJson));
				onCreateLlm(advancedJson);
				setErrorMsg("");
			} catch (e: any) {
				setErrorMsg(`JSON 无效：${e?.message ?? e}`);
			}
		}
	};

	return (
		<Dialog.Root>
			<Dialog.Trigger>
				<Button>
					<Plus size={16} />
					添加LLM资源
				</Button>
			</Dialog.Trigger>
			<Dialog.Content
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
				<Dialog.Title>添加 LLM 资源</Dialog.Title>
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
					<>
						<Heading size="3" my="5">
							基本信息
						</Heading>
						<Grid columns="0fr 1fr" align="center" gap="2">
							<Text wrap="nowrap">显示名称</Text>
							<TextField.Root
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
							/>
							<Text wrap="nowrap">模型</Text>
							<TextField.Root
								value={model}
								onChange={(e) => setModel(e.target.value)}
							/>
							<Text wrap="nowrap">本地模型</Text>
							<Flex align="center" gap="2">
								<Switch checked={isLocal} onCheckedChange={setIsLocal} />
								{isLocal && <Badge color="cyan">Local</Badge>}
							</Flex>
							<Text wrap="nowrap">启用</Text>
							<Switch checked={enabled} onCheckedChange={setEnabled} />
						</Grid>

						<Heading size="3" my="5">
							连接配置
						</Heading>
						<Grid columns="0fr 1fr" align="baseline" gap="2">
							<Text wrap="nowrap">API 基础 URL</Text>
							<TextField.Root
								value={baseUrl}
								onChange={(e) => setBaseUrl(e.target.value)}
							/>
							<Text wrap="nowrap">API Key</Text>
							<TextField.Root
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
							/>
							<Text wrap="nowrap">健康检查 URL</Text>
							<TextField.Root
								type="text"
								value={healthUrl}
								onChange={(e) => setHealthUrl(e.target.value)}
							/>
						</Grid>

						<Heading size="3" my="5">
							参数配置
						</Heading>
						<Grid columns="0fr 1fr" align="baseline" gap="2">
							<Text wrap="nowrap">最大 Tokens</Text>
							<TextField.Root
								type="number"
								value={maxTokens ?? ""}
								onChange={(e) =>
									setMaxTokens(
										e.target.value ? Number(e.target.value) : undefined,
									)
								}
							/>
						</Grid>
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
											uri: LLM_DEFINITION_SCHEMA_URI,
											fileMatch: ["inmemory://model/llm-create.json"],
											schema: LLM_DEFINITION_JSON_SCHEMA as any,
										},
									],
								});
							}}
							language="json"
							theme={theme === "dark" ? "vs-dark" : "light"}
							value={advancedJson}
							onChange={(v) => setAdvancedJson(v ?? "")}
							options={{ minimap: { enabled: false }, automaticLayout: true }}
							path="inmemory://model/llm-create.json"
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
							onClick={handleCreateClick}
							disabled={mode === "form" ? !canSubmitForm() : !canSubmitJson()}
						>
							创建
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export default CreateLlmDialog;
