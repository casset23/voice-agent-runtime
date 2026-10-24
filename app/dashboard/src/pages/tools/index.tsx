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
import { atomWithRefresh } from "jotai/utils";
import { Search } from "lucide-react";
import { Suspense, useEffect } from "react";
import { toast } from "react-toastify";
import { titleAtom } from "@/states/common.ts";
import {
	createTool,
	deleteTool,
	listTools,
	type ToolOverview,
	updateTool,
} from "./api.ts";
import CreateToolDialog from "./CreateToolDialog";
import DeleteToolDialog from "./DeleteToolDialog";
import EditToolDialog from "./EditToolDialog";
import styles from "./index.module.css";

// 工具列表项组件
function ToolItem({
	tool,
	onRefresh,
}: {
	tool: ToolOverview;
	onRefresh: () => void;
}) {
	const handleEdit = async (toolDefinition: string) => {
		try {
			await updateTool(tool.name, JSON.parse(toolDefinition));
			onRefresh();
		} catch (error) {
			console.error("编辑工具失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`编辑工具失败: ${message}`);
		}
	};

	const handleDelete = async () => {
		try {
			await deleteTool(tool.name);
			onRefresh();
		} catch (error) {
			console.error("删除工具失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`删除工具失败: ${message}`);
		}
	};

	return (
		<Flex className={styles.toolItem} p="2">
			<Flex gap="2" align="baseline" flexGrow="1">
				<Box flexGrow="1" flexBasis="10px">
					{tool.name}
				</Box>
				<Flex
					flexGrow="1"
					flexBasis="100px"
					direction="column"
					align="start"
					gap="2"
				>
					<Badge>{tool.description}</Badge>
					<Flex gap="2" align="baseline">
						<Badge color="grass">功能</Badge>
						<Text size="2">{tool.functionsCount} 个</Text>
					</Flex>
				</Flex>
			</Flex>
			<Flex flexShrink="0" align="baseline" justify="end" gap="2">
				<EditToolDialog toolName={tool.name} onEditTool={handleEdit} />
				<DeleteToolDialog toolName={tool.name} onDeleteTool={handleDelete} />
			</Flex>
		</Flex>
	);
}

const toolsListAtom = atomWithRefresh(listTools);

function ToolsList({ onRefresh }: { onRefresh: () => void }) {
	const tools = useAtomValue(toolsListAtom);

	return tools.map((tool) => (
		<ToolItem key={tool.name} tool={tool} onRefresh={onRefresh} />
	));
}

function ToolsPage() {
	const store = useStore();
	const refreshList = useSetAtom(toolsListAtom);

	useEffect(() => {
		store.set(titleAtom, "工具管理");
		return () => {
			store.set(titleAtom, "");
		};
	}, [store]);

	const handleCreateTool = async (toolDefinition: string) => {
		try {
			console.log("接收到的 toolDefinition:", toolDefinition);
			console.log("toolDefinition 类型:", typeof toolDefinition);
			const parsed = JSON.parse(toolDefinition);
			console.log("解析后的对象:", parsed);
			await createTool(parsed);
			refreshList();
		} catch (error) {
			console.error("创建工具失败:", error);
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`创建工具失败: ${message}`);
		}
	};

	return (
		<div className={styles.toolsPageContainer}>
			<div className={styles.toolsHeader}>
				<CreateToolDialog onCreateTool={handleCreateTool} />
				<Button variant="soft" onClick={() => refreshList()}>
					刷新列表
				</Button>
				<Box flexGrow="1" />
				{/* TODO: 搜索功能 */}
				<TextField.Root placeholder="搜索工具">
					<TextField.Slot>
						<Search size={16} />
					</TextField.Slot>
				</TextField.Root>
			</div>
			<Suspense
				fallback={
					<div className={styles.loadingContainer}>
						加载工具列表...
						<Spinner />
					</div>
				}
			>
				<ToolsList onRefresh={refreshList} />
			</Suspense>
		</div>
	);
}

export default ToolsPage;
