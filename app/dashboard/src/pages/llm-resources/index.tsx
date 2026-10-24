import {
	Badge,
	Box,
	Button,
	Flex,
	Spinner,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { AlarmClockCheck, Search } from "lucide-react";
import { Suspense, useEffect } from "react";
import { toast } from "react-toastify";
import { titleAtom } from "@/states/common.ts";
import {
	type LlmSummary,
	checkLlmHealth,
	createLlm,
	deleteLlm,
	llmResourcesListAtom,
	updateLlm,
} from "./api.ts";
import CreateLlmDialog from "./CreateLlmDialog.tsx";
import DeleteLlmDialog from "./DeleteLlmDialog.tsx";
import EditLlmDialog from "./EditLlmDialog.tsx";
import styles from "./index.module.css";
import { useBefore } from "@/utils/day.ts";

// 状态标签组件
function StatusBadge({ llm }: { llm: LlmSummary }) {
	const key: string = llm.lastStatus || (llm.enabled ? "unknown" : "disabled");
	const mapping: Record<string, { label: string; className: string }> = {
		online: { label: "在线", className: styles.statusActive },
		offline: { label: "离线", className: styles.statusInactive },
		error: { label: "错误", className: styles.statusError },
		disabled: { label: "已停用", className: styles.statusInactive },
		unknown: { label: "未知", className: styles.statusInactive },
	};
	const cfg = mapping[key] || mapping.unknown;
	return (
		<span className={`${styles.statusBadge} ${cfg.className}`}>
			{cfg.label}
		</span>
	);
}

// LLM资源列表项组件
function LlmResourceItem({
	llm,
	onRefresh,
}: {
	llm: LlmSummary;
	onRefresh: () => void;
}) {
	const handleEdit = async (id: string, llmDefinition: string) => {
		try {
			await updateLlm(id, JSON.parse(llmDefinition));
			onRefresh();
		} catch (error) {
			console.error("编辑LLM资源失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`编辑LLM资源失败: ${message}`);
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteLlm(id);
			onRefresh();
		} catch (error) {
			console.error("删除LLM资源失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`删除LLM资源失败: ${message}`);
		}
	};

	const handleCheckHealth = async () => {
		const id = toast.loading("正在检查健康状态...");
		try {
			const res = await checkLlmHealth(llm.id);
			if (res.error) {
				toast.update(id, {
					type: "error",
					isLoading: false,
					render: `健康检查失败: ${res.error}`,
					autoClose: 5000,
					closeButton: true,
				});
			} else {
				toast.update(id, {
					type: "success",
					isLoading: false,
					render: `健康检查成功: ${res.status}${res.latencyMs != null ? ` (${res.latencyMs}ms)` : ""}`,
					autoClose: 5000,
					closeButton: true,
				});
				// 健康检查成功后刷新列表，同步状态
				onRefresh();
			}
		} catch (error) {
			console.error("健康检查失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.update(id, {
				type: "error",
				isLoading: false,
				render: `健康检查失败: ${message}`,
				autoClose: 5000,
				closeButton: true,
			});
		}
	};

	const lastCheckTime = useBefore(llm.lastCheckedAt || "");

	return (
		<Flex className={styles.llmItem} p="2" align="center">
			<Box width="60px">
				<StatusBadge llm={llm} />
			</Box>

			<Flex direction="column" gap="2" flexGrow="1">
				<Flex gap="2" align="baseline" width="100%">
					<Text weight="bold" size="3">
						{llm.displayName}
					</Text>
					<Badge color="indigo">{llm.model}</Badge>
					{llm.isLocal && <Badge color="cyan">本地</Badge>}
					{llm.baseUrl && <Badge color="gray">{llm.baseUrl}</Badge>}
				</Flex>

				<Flex gap="2" align="center" width="100%">
					<AlarmClockCheck size={16} />
					<Text size="2" color="gray">
						{lastCheckTime}
					</Text>
				</Flex>
			</Flex>

			<Flex flexShrink="0" align="center" justify="end" gap="2">
				<Button variant="soft" size="1" onClick={handleCheckHealth}>
					健康
				</Button>
				<EditLlmDialog
					llmName={llm.displayName}
					llmId={llm.id}
					onEditLlm={handleEdit}
				/>
				<DeleteLlmDialog
					llmName={llm.displayName}
					llmId={llm.id}
					onDeleteLlm={handleDelete}
				/>
			</Flex>
		</Flex>
	);
}

function LlmResourcesList({ onRefresh }: { onRefresh: () => void }) {
	const resources = useAtomValue(llmResourcesListAtom);

	return resources.map((llm) => (
		<LlmResourceItem
			key={llm.id}
			llm={llm as unknown as LlmSummary}
			onRefresh={onRefresh}
		/>
	));
}

function LlmResourcesPage() {
	const store = useStore();
	const refreshList = useSetAtom(llmResourcesListAtom);

	useEffect(() => {
		store.set(titleAtom, "LLM 资源管理");
		return () => {
			store.set(titleAtom, "");
		};
	}, [store]);

	const handleCreateLlm = async (llmDefinition: string) => {
		try {
			await createLlm(JSON.parse(llmDefinition));
			refreshList();
		} catch (error) {
			console.error("创建LLM资源失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`创建LLM资源失败: ${message}`);
		}
	};

	return (
		<div className={styles.llmPageContainer}>
			<div className={styles.llmHeader}>
				<CreateLlmDialog onCreateLlm={handleCreateLlm} />
				<Button variant="soft" onClick={() => refreshList()}>
					刷新列表
				</Button>
				<Box flexGrow="1" />
				{/* 搜索功能 */}
				<TextField.Root placeholder="搜索LLM资源">
					<TextField.Slot>
						<Search size={16} />
					</TextField.Slot>
				</TextField.Root>
			</div>
			<Suspense
				fallback={
					<div className={styles.loadingContainer}>
						加载LLM资源列表...
						<Spinner />
					</div>
				}
			>
				<LlmResourcesList onRefresh={refreshList} />
			</Suspense>
		</div>
	);
}

export default LlmResourcesPage;
