"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "@/lib/types";

const axisStyle = {
  fontSize: 9.5,
  fill: "#96908a",
  fontFamily: "var(--font-geist-mono)",
};

type TooltipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-none border border-line-strong bg-surface px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">{label}</p>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center gap-2 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
          <span className="text-muted">{item.name}</span>
          <span className="ml-auto font-mono text-ink">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function SessionsChart({ data, height = 248 }: { data: ChartPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillContained" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#221e1c" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#221e1c" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillTransferred" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a9762a" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#a9762a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(34,30,28,0.09)" vertical={false} strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            interval={1}
            dy={8}
          />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(34,30,28,0.2)" }} />
          <Area
            type="monotone"
            dataKey="contained"
            name="AI contained"
            stroke="#221e1c"
            strokeWidth={1.8}
            fill="url(#fillContained)"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: "#221e1c", stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="transferred"
            name="Transferred"
            stroke="#a9762a"
            strokeWidth={1.5}
            fill="url(#fillTransferred)"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: "#a9762a", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ContainmentTrend({ data, height = 170 }: { data: ChartPoint[]; height?: number }) {
  const points = data.map((point) => ({
    ...point,
    containment: point.total ? Math.round((point.contained / point.total) * 1000) / 10 : 0,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(34,30,28,0.09)" vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval={3} dy={8} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={36}
            domain={[55, 90]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(34,30,28,0.2)" }} />
          <Line
            type="monotone"
            dataKey="containment"
            name="Containment"
            stroke="#3f6b63"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: "#3f6b63", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({
  data,
  centerValue,
  centerLabel,
  height = 168,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  centerValue: string;
  centerLabel: string;
  height?: number;
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="64%"
            outerRadius="88%"
            paddingAngle={3}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[21px] font-semibold tracking-[-0.04em] text-ink">{centerValue}</span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-2">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export function IntentBars({
  data,
  height = 220,
}: {
  data: Array<{ intent: string; count: number; escalationRate: number }>;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(34,30,28,0.09)" horizontal={false} strokeDasharray="3 4" />
          <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="intent"
            tick={{ ...axisStyle, fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={118}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(34,30,28,0.04)" }} />
          <Bar dataKey="count" name="Sessions" fill="#221e1c" radius={0} barSize={9} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  values,
  tone = "#221e1c",
  width = 92,
  height = 28,
}: {
  values: number[];
  tone?: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - 3 - ((value - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const id = `spark-${tone.replace("#", "")}-${values.length}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.25} />
          <stop offset="100%" stopColor={tone} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${points} ${width},${height}`} fill={`url(#${id})`} stroke="none" />
      <polyline points={points} fill="none" stroke={tone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
