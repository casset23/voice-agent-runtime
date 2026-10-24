import { Provider } from "jotai";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRouter from "./Routes.tsx";
import "@radix-ui/themes/styles.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
	throw new Error("Root element not found");
}

createRoot(rootEl).render(
	<StrictMode>
		<Provider>
			<AppRouter />
			<ToastContainer />
		</Provider>
	</StrictMode>,
);
