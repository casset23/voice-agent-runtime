import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

// 使用Lazy懒加载各页面组件
const ErrorPage = lazy(() => import("./pages/error/index.tsx"));
const HomePage = lazy(() => import("./pages/home/index.tsx"));
const ScaffordPage = lazy(() => import("./pages/scafford/index.tsx"));
const ToolsPage = lazy(() => import("./pages/tools/index.tsx"));
const LlmResourcesPage = lazy(() => import("./pages/llm-resources/index.tsx"));

function AppRouter() {
	return (
		<BrowserRouter>
			<Suspense fallback={<div>加载中...</div>}>
				<Routes>
					<Route path="/" element={<ScaffordPage />}>
						<Route index element={<HomePage />} />
						<Route path="" element={<HomePage />} />
						<Route path="tools" element={<ToolsPage />} />
						<Route path="llm-resources" element={<LlmResourcesPage />} />
						<Route path="*" element={<ErrorPage />} />
					</Route>
				</Routes>
			</Suspense>
		</BrowserRouter>
	);
}

export default AppRouter;
