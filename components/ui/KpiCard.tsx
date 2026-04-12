// components/ui/KpiCard.tsx
import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: string;
}

export function KpiCard({ label, value, change, trend, icon }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">{icon}</span>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      <p className={clsx(
        trend === "up" ? "kpi-up" : trend === "down" ? "kpi-down" : "kpi-neutral"
      )}>
        {trend === "up" ? "▲" : trend === "down" ? "▼" : "●"} {change}
      </p>
    </div>
  );
}
