import type { ComponentType } from "react";
import {
  Percent,
  TrendingUp,
  Tag,
  Scale,
  ChefHat,
  BadgePercent,
  Landmark,
  Clock,
  Calculator,
  Wallet,
  Receipt,
  PiggyBank,
  ShoppingCart,
  UtensilsCrossed,
  Martini,
  HandCoins,
  Boxes,
  RefreshCw,
  Target,
  CircleDollarSign,
  Smartphone,
} from "lucide-react";

const icons: Record<string, ComponentType<{ className?: string }>> = {
  percent: Percent,
  "trending-up": TrendingUp,
  tag: Tag,
  scale: Scale,
  "chef-hat": ChefHat,
  "badge-percent": BadgePercent,
  landmark: Landmark,
  clock: Clock,
  wallet: Wallet,
  receipt: Receipt,
  "piggy-bank": PiggyBank,
  "shopping-cart": ShoppingCart,
  "utensils-crossed": UtensilsCrossed,
  martini: Martini,
  "hand-coins": HandCoins,
  boxes: Boxes,
  "refresh-cw": RefreshCw,
  target: Target,
  "circle-dollar-sign": CircleDollarSign,
  smartphone: Smartphone,
};

export function CalculatorIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Calculator;
  return <Icon className={className} aria-hidden="true" />;
}
