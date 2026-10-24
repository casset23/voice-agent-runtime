import dayjs from "dayjs";
import zhCN from "dayjs/locale/zh-cn";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMemo } from "react";

dayjs.extend(relativeTime);
dayjs.locale(zhCN);

export const useBefore = (timestamp: string) =>
	useMemo(() => {
		try {
			return dayjs(timestamp).fromNow();
		} catch {
			return "未知";
		}
	}, [timestamp]);

export default dayjs;
