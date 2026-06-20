"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
  borderRadius: "var(--radius-sm)",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};

export default function ForecastChart({ data, currency }: { data: { month: string; projected: number }[]; currency: string }) {
  if (!data.some((d) => d.projected > 0)) return <p className="text-sm text-ink-3">Add subscriptions to project spend.</p>;
  const avg = data.reduce((s, d) => s + d.projected, 0) / data.length;
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <XAxis
            dataKey="month"
            stroke="var(--line)"
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={40}
          />
          <YAxis
            stroke="var(--line)"
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
            tickFormatter={(v) => fmt(v)}
          />
          <Tooltip
            formatter={(v) => fmt(Number(v))}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="projected" radius={[4, 4, 0, 0]}>
            {/* Highlight months that spike above average (annual renewals). */}
            {data.map((d, i) => (
              <Cell key={i} fill={d.projected > avg * 1.4 ? "var(--warning)" : "var(--data-blue)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
