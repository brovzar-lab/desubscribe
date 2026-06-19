"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#6d8bff", "#3ecf8e", "#f5a623", "#ff5d6c", "#a78bfa", "#22d3ee", "#f472b6", "#9ca3af"];

export default function CategoryChart({ data }: { data: { category: string; monthly: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="monthly" nameKey="category" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}/mo`}
            contentStyle={{ background: "#11182e", border: "1px solid #1e2842", borderRadius: 12, color: "#e7ecff" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {data.map((d, i) => (
          <span key={d.category} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {d.category}
          </span>
        ))}
      </div>
    </div>
  );
}
