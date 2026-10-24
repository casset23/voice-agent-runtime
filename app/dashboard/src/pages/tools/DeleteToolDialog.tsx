import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import styles from "./index.module.css";

interface DeleteToolDialogProps {
	toolName: string;
	onDeleteTool: () => void;
}

function DeleteToolDialog({ toolName, onDeleteTool }: DeleteToolDialogProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
	};

	const handleDeleteClick = () => {
		onDeleteTool();
		setIsOpen(false);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
			<Dialog.Trigger>
				<Button variant="soft" color="red" size="1">
					删除
				</Button>
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Title>确认删除</Dialog.Title>
				<Dialog.Description>
					<Text>
						您确定要删除工具 &quot;{toolName}&quot; 吗？此操作不可恢复。
					</Text>
				</Dialog.Description>
				<Flex justify="end" gap="2" className={styles.dialogActions}>
					<Dialog.Close>
						<Button variant="soft" size="2">
							取消
						</Button>
					</Dialog.Close>
					<Button
						variant="solid"
						color="red"
						size="2"
						onClick={handleDeleteClick}
					>
						确认删除
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export default DeleteToolDialog;
