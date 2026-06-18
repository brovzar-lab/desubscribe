"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function TrendChart({ data }: { data: { month: string; total: number }[] }) {
  const hasData = data.some((d) => d.total > 0);
  if (!hasData) return <p className="text-sm text-muted">No charge history yet — sync to populate.</p>;
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6d8bff" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#6d8bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" stroke="#8a95b5" fontSize={11} tickLine={false} />
          <YAxis stroke="#8a95b5" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}`}
            contentStyle={{ background: "#11182e", border: "1px solid #1e2842", borderRadius: 12, color: "#e7ecff" }}
          />
          <Area type="monotone" dataKey="total" stroke="#6d8bff" fill="url(#g)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
