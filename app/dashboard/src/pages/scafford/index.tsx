import {
	House,
	Moon,
	PanelRightClose,
	PanelRightOpen,
	Server,
	Sun,
	Wrench,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import "./index.css";
import { Card, IconButton, Theme, Tooltip } from "@radix-ui/themes";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Link, Outlet } from "react-router";
import logo from "../../assets/logo.svg";
import {
	expandedSidebarAtom,
	themeAtom,
	titleAtom,
} from "../../states/common.ts";
import styles from "./index.module.css";

// 可折叠文本组件，根据侧边栏展开状态显示或隐藏文本
const CollapsibleText = ({ children }: { children: ReactNode }) => {
	return <span className={styles.sidebarText}>{children}</span>;
};

const TopBarContainer = ({
	children,
	className,
}: {
	children?: ReactNode;
	className?: string;
}) => {
	return (
		<div
			className={clsx(styles.topBarContainer, className)}
			style={{
				borderTopLeftRadius: "calc(var(--radius-5) + 1px)", // 修正一下圆角
				borderTopRightRadius: "calc(var(--radius-5) + 1px)",
			}}
		>
			{children}
		</div>
	);
};

const SideButton = ({
	children,
	content,
	to,
}: {
	children?: ReactNode;
	content: string;
	to: string;
}) => {
	return (
		<Tooltip content={content} side="right">
			<Link to={to} className={styles.sideButton} viewTransition>
				{children}
			</Link>
		</Tooltip>
	);
};

function ScaffordPage() {
	const [theme, setTheme] = useAtom(themeAtom);
	const [expandedSidebar, setExpandedSidebar] = useAtom(expandedSidebarAtom);
	const title = useAtomValue(titleAtom);

	useEffect(() => {
		if (title) {
			document.title = `${title} - Co-Agent 控制台`;
		} else {
			document.title = "Co-Agent 控制台";
		}
	}, [title]);

	return (
		<Theme className={styles.container} appearance={theme} accentColor="indigo">
			<div
				id="sidebar"
				className={clsx(styles.sidebar, expandedSidebar && styles.expanded)}
			>
				<div className={styles.spacer} />
				<TopBarContainer>
					<div className={styles.logo}>
						<img src={logo} alt="Logo" className={styles.logoImage} />
					</div>
					<h3>
						<CollapsibleText>Co-Agent 控制台</CollapsibleText>
					</h3>
				</TopBarContainer>

				<div className={styles.sidebarContent}>
					<SideButton to="/" content="主页">
						<House size={16} className={styles.icon} />
						<CollapsibleText>主页</CollapsibleText>
					</SideButton>
					<SideButton to="/tools" content="工具管理">
						<Wrench size={16} className={styles.icon} />
						<CollapsibleText>工具管理</CollapsibleText>
					</SideButton>
					<SideButton to="/llm-resources" content="LLM 资源管理">
						<Server size={16} className={styles.icon} />
						<CollapsibleText>LLM 资源管理</CollapsibleText>
					</SideButton>

					<div className={styles.flex1} />

					{/* <SideButton content='设置'>
                        <Settings size={16} className={styles.icon} />
                        <CollapsibleText>设置</CollapsibleText>
                    </SideButton>
                    <SideButton content='登出'>
                        <LogOut size={16} className={styles.icon} />
                        <CollapsibleText>登出</CollapsibleText>
                    </SideButton> */}
				</div>
			</div>
			<main className={styles.main}>
				<Card
					className={styles.content}
					style={{
						padding: "1px",
					}}
					size="3"
				>
					<div className={styles.contentScroll}>
						<TopBarContainer className="sticky top-0">
							<IconButton
								style={{
									marginLeft: "0",
								}}
								className={styles.noMarginLeft}
								variant="ghost"
								size="4"
								onClick={() => {
									setExpandedSidebar(!expandedSidebar);
								}}
							>
								{expandedSidebar ? <PanelRightOpen /> : <PanelRightClose />}
							</IconButton>
							<h3 className={styles.flex1}>{title}</h3>

							<IconButton
								style={{
									marginRight: "0",
								}}
								className={styles.noMarginRight}
								variant="ghost"
								size="4"
								onClick={() => {
									const newTheme = theme === "dark" ? "light" : "dark";
									setTheme(newTheme);
								}}
							>
								{theme === "dark" ? <Sun /> : <Moon />}
							</IconButton>
						</TopBarContainer>

						<Outlet />
					</div>
				</Card>
			</main>
		</Theme>
	);
}

export default ScaffordPage;
