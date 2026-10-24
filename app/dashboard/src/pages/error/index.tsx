const ErrorPage = () => {
	return (
		<div className="flex flex-col items-center justify-center h-screen">
			<h1 className="text-4xl font-bold">404 - 页面未找到</h1>
			<p className="mt-4 text-lg text-gray-700">请返回主页以重试</p>
		</div>
	);
};

export default ErrorPage;
