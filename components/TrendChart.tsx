"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
  borderRadius: "var(--radius-sm)",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};

export default function TrendChart({ data }: { data: { month: string; total: number }[] }) {
  const hasData = data.some((d) => d.total > 0);
  if (!hasData) return <p className="text-sm text-ink-3">No charge history yet — sync to populate.</p>;
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--data-blue)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--data-blue)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            stroke="var(--line)"
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="var(--line)"
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}`}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--data-blue)"
            fill="url(#trendGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
