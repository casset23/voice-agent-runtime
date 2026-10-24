import wrench from "wretch";

/**
 * 统一的 API 客户端对象
 */
export const apiClient = wrench("http://localhost:30013", {
	headers: {
		"Content-Type": "application/json",
	},
});
