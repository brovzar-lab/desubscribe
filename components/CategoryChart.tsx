"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const BASE_COLORS = [
  "var(--data-blue)",
  "var(--data-violet)",
  "var(--data-teal)",
  "var(--data-coral)",
];

const OPACITIES = [1, 0.7, 0.45];

function getColor(index: number): { fill: string; opacity: number } {
  const baseIndex = index % BASE_COLORS.length;
  const opacityIndex = Math.floor(index / BASE_COLORS.length) % OPACITIES.length;
  return { fill: BASE_COLORS[baseIndex], opacity: OPACITIES[opacityIndex] };
}

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
  borderRadius: "var(--radius-sm)",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};

export default function CategoryChart({ data }: { data: { category: string; monthly: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-ink-3">No data yet.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="monthly" nameKey="category" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {data.map((_, i) => {
              const c = getColor(i);
              return <Cell key={i} fill={c.fill} fillOpacity={c.opacity} stroke="none" />;
            })}
          </Pie>
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}/mo`}
            contentStyle={TOOLTIP_STYLE}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
        {data.map((d, i) => {
          const c = getColor(i);
          return (
            <span key={d.category} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: c.fill, opacity: c.opacity }}
              />
              {d.category}
            </span>
          );
        })}
      </div>
    </div>
  );
}
