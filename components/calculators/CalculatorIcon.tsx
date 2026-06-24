import type { ComponentType } from "react";
import { Percent, TrendingUp, Tag, Scale, ChefHat, BadgePercent, Landmark, Clock, Calculator } from "lucide-react";

const icons: Record<string, ComponentType<{ className?: string }>> = {
  percent: Percent,
  "trending-up": TrendingUp,
  tag: Tag,
  scale: Scale,
  "chef-hat": ChefHat,
  "badge-percent": BadgePercent,
  landmark: Landmark,
  clock: Clock,
};

export function CalculatorIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Calculator;
  return <Icon className={className} aria-hidden="true" />;
}
