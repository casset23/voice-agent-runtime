import { Callout, Card } from "@radix-ui/themes";
import { useStore } from "jotai";
import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	YAxis,
} from "recharts";
import { titleAtom } from "@/states/common.ts";

interface ChartData {
	value: number;
}

interface StatsChartCardProps {
	title: string;
	suffix?: string;
	width?: string;
	height?: number;
	maxValue?: number;
	dataGenerator?: () => number;
	updateInterval?: number;
	strokeColor?: string;
	fillColor?: string;
	titleColor?: string;
	valueColor?: string;
	className?: string;
}

const DATA_AMOUNT = 100; // 初始数据点数量

function StatsChartCard({
	title,
	suffix = "%",
	width = "400px",
	height = 200,
	maxValue = 100,
	dataGenerator = () => Math.random() * 100,
	updateInterval = 1000,
	strokeColor = "#4a59ca",
	fillColor = "#5d70fd",
	titleColor = "#64748b",
	valueColor = "#1e293b",
	className = "",
}: StatsChartCardProps) {
	const [data, setData] = useState<ChartData[]>([]);
	const store = useStore();

	useEffect(() => {
		store.set(titleAtom, "主页");
		return () => {
			store.set(titleAtom, "");
		};
	}, [store]);

	useEffect(() => {
		setData(
			Array.from({ length: DATA_AMOUNT }, () => ({ value: dataGenerator() })),
		);

		const interval = setInterval(() => {
			setData((prevData) => {
				const newValue = dataGenerator();
				return [...prevData.slice(1 - DATA_AMOUNT), { value: newValue }];
			});
		}, updateInterval);

		return () => clearInterval(interval);
	}, [dataGenerator, updateInterval]);

	const currentValue = useMemo(() => {
		return data[data.length - 1]?.value || 0;
	}, [data]);

	const gradientId = useMemo(() => {
		// 使用完全兼容的ID生成方案
		return `gradient-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
	}, []);

	return (
		<Card
			className={`w-[${width}] ${className}`}
			style={{ padding: "0", minWidth: "300px" }}
		>
			<div className="absolute top-4 left-4 z-1 font-semibold">
				<div className="dark:brightness-150" style={{ color: titleColor }}>
					{title}
				</div>
				<div
					className="text-4xl dark:brightness-125"
					style={{ color: valueColor }}
				>
					{Math.floor(currentValue)}
					{suffix}
				</div>
			</div>
			<ResponsiveContainer width="100%" height={height}>
				<AreaChart
					data={data}
					margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
				>
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={fillColor} stopOpacity={0.5} />
							<stop offset="100%" stopColor={fillColor} stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid vertical={false} />
					<Area
						type="monotone"
						dataKey="value"
						max={maxValue}
						stroke={strokeColor}
						fill={`url(#${gradientId})`}
						strokeWidth={2}
						dot={false}
						activeDot={{ r: 4 }}
						isAnimationActive={false}
					/>
					<YAxis mirror orientation="right" />
				</AreaChart>
			</ResponsiveContainer>
		</Card>
	);
}

// 数据生成器函数
// 生成自 AI，因为现在还没有正式接入后端
const dataGenerators = {
	// CPU 使用率：20-80%之间，有突发性
	cpu: (() => {
		let baseValue = 45;
		return () => {
			// 缓慢变化的基础值
			baseValue += (Math.random() - 0.5) * 2;
			baseValue = Math.max(20, Math.min(80, baseValue));

			// 添加突发性变化
			const spike = Math.random() < 0.1 ? Math.random() * 30 : 0;
			return Math.min(100, baseValue + spike);
		};
	})(),

	// 内存使用率：逐渐上升，偶尔释放
	memory: (() => {
		let baseValue = 60;
		let direction = 1;
		return () => {
			// 逐渐上升
			baseValue += direction * (Math.random() * 3 + 1);

			// 到达80%以上时偶尔大幅释放
			if (baseValue > 80 && Math.random() < 0.3) {
				baseValue = 40 + Math.random() * 20;
				direction = 1;
			} else if (baseValue > 95) {
				baseValue = 50 + Math.random() * 20;
				direction = 1;
			} else if (baseValue < 30) {
				direction = 1;
			}

			return Math.max(25, Math.min(100, baseValue));
		};
	})(),

	// 网络流量：波动较大，有周期性
	network: (() => {
		let time = 0;
		return () => {
			time += 0.1;
			// 基础波动 + 周期性变化 + 随机噪声
			const base = 50 + Math.sin(time) * 30;
			const noise = (Math.random() - 0.5) * 40;
			const spike = Math.random() < 0.05 ? Math.random() * 200 : 0;
			return Math.max(0, Math.min(500, base + noise + spike));
		};
	})(),

	// 请求量：有明显的峰谷，模拟真实流量
	requests: (() => {
		let time = 0;
		let trend = 100;
		return () => {
			time += 0.1;
			// 缓慢变化的趋势
			trend += (Math.random() - 0.5) * 10;
			trend = Math.max(50, Math.min(200, trend));

			// 周期性变化（模拟业务高峰期）
			const cycle = Math.sin(time * 0.5) * 80;

			// 随机波动
			const noise = (Math.random() - 0.5) * 50;

			// 偶尔的流量爆发
			const burst = Math.random() < 0.08 ? Math.random() * 300 : 0;

			return Math.max(0, trend + cycle + noise + burst);
		};
	})(),

	// 缓存命中率：逐渐上升，偶尔下降
	cacheHitRate: (() => {
		let baseValue = 70;
		return () => {
			// 缓慢上升
			baseValue += (Math.random() - 0.5) * 2;
			baseValue = Math.max(50, Math.min(95, baseValue));

			// 偶尔下降
			if (Math.random() < 0.1) {
				baseValue -= Math.random() * 10;
			}

			return Math.max(0, Math.min(100, baseValue));
		};
	})(),
};

function MockCpuUsageChart() {
	return (
		<StatsChartCard
			title="CPU 使用率"
			suffix="%"
			maxValue={100}
			dataGenerator={dataGenerators.cpu}
			strokeColor="#ef4444"
			fillColor="#dc2626"
			titleColor="#dc2626"
			valueColor="#991b1b"
		/>
	);
}

function MockMemoryUsageChart() {
	return (
		<StatsChartCard
			title="内存使用率"
			suffix="%"
			maxValue={100}
			dataGenerator={dataGenerators.memory}
			strokeColor="#f59e0b"
			fillColor="#d97706"
			titleColor="#d97706"
			valueColor="#92400e"
		/>
	);
}

function MockNetworkChart() {
	return (
		<StatsChartCard
			title="网络流量"
			suffix=" MB/s"
			maxValue={500}
			dataGenerator={dataGenerators.network}
			strokeColor="#10b981"
			fillColor="#059669"
			titleColor="#059669"
			valueColor="#047857"
		/>
	);
}

function MockRequestsChart() {
	return (
		<StatsChartCard
			title="请求量"
			suffix=" 次/s"
			maxValue={1000}
			dataGenerator={dataGenerators.requests}
			strokeColor="#8b5cf6"
			fillColor="#7c3aed"
			titleColor="#7c3aed"
			valueColor="#6d28d9"
		/>
	);
}

function MockCacheHitRateChart() {
	return (
		<StatsChartCard
			title="缓存命中率"
			suffix="%"
			maxValue={100}
			dataGenerator={dataGenerators.cacheHitRate}
			strokeColor="#0070F5"
			fillColor="#148EFF"
			titleColor="#148EFF"
			valueColor="#0070F5"
		/>
	);
}

function HomePage() {
	return (
		<div className="flex flex-col gap-2 p-2">
			<Callout.Root color="orange">
				<Callout.Icon>
					<Info size={16} />
				</Callout.Icon>
				<Callout.Text>
					本控制台目前处于开发阶段，部分功能可能仍是模拟数据。
				</Callout.Text>
			</Callout.Root>

			<div className="flex flex-wrap items-center justify-center gap-4">
				<MockCpuUsageChart />
				<MockMemoryUsageChart />
				<MockNetworkChart />
				<MockRequestsChart />
				<MockCacheHitRateChart />
			</div>

			{Array.from({ length: 20 }).map((_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: 测试用
				<Card key={`${index}`} className="p-4">
					<h4 className="text-lg font-semibold">示例卡片 {index + 1}</h4>
					<p>这是一个示例卡片内容</p>
				</Card>
			))}
		</div>
	);
}

export default HomePage;
