"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type DataPoint = { date: string; dvs: number; seo: number; aeo: number };

type Props = { data: DataPoint[]; className?: string };

const W = 600;
const H = 120;
const PAD = { top: 8, right: 8, bottom: 20, left: 24 };

function toPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

export function TrendChart({ data, className }: Props) {
  if (data.length < 2) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-border bg-card p-8", className)}>
        <p className="text-xs text-muted-foreground">Trend data will appear after 2+ scans</p>
      </div>
    );
  }

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - (v / 100) * chartH;

  const dvsPath = toPath(data.map((d, i) => ({ x: xScale(i), y: yScale(d.dvs) })));
  const seoPath = toPath(data.map((d, i) => ({ x: xScale(i), y: yScale(d.seo) })));
  const aeoPath = toPath(data.map((d, i) => ({ x: xScale(i), y: yScale(d.aeo) })));

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium">30-day trend</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-primary" />DVS™</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-green-400" />SEO</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-violet-400" />AEO</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Score trend chart">
        {/* Grid lines */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left} y1={yScale(t)}
              x2={W - PAD.right} y2={yScale(t)}
              stroke="currentColor" strokeWidth={0.5}
              className="text-border"
            />
            <text x={PAD.left - 4} y={yScale(t) + 3} textAnchor="end"
              className="fill-muted-foreground" fontSize={8}>{t}</text>
          </g>
        ))}

        {/* Lines */}
        <motion.path d={seoPath} fill="none" stroke="#4ade80" strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }} />
        <motion.path d={aeoPath} fill="none" stroke="#a78bfa" strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.23, 1, 0.32, 1] }} />
        <motion.path d={dvsPath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }} />

        {/* X-axis date labels (first + last) */}
        {[0, data.length - 1].map((i) => (
          <text key={i} x={xScale(i)} y={H - 2} textAnchor={i === 0 ? "start" : "end"}
            className="fill-muted-foreground" fontSize={7}>
            {data[i].date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}
