export type IslandId =
  | "core"
  | "management"
  | "marketing"
  | "sales"
  | "creative"
  | "finance"
  | "development"
  | "customer_success"
  | "system"
  | "agents";

export type AgentState =
  | "idle"
  | "working"
  | "waiting"
  | "error"
  | "completed"
  | "overloaded";

export type AgentRole =
  | "ceo"
  | "marketing"
  | "sales"
  | "creative"
  | "finance"
  | "dev"
  | "customer_success"
  | "system";

export type IslandStatus = "good" | "watch" | "alert";

export interface IslandKpi {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}

export interface IslandSummary {
  id: IslandId;
  name: string;
  description: string;
  agentRole: AgentRole;
  agentName: string;
  kpis: IslandKpi[];
  openTasks: number;
  alerts: number;
  status: IslandStatus;
}

export interface LayoutItem {
  module_id: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  is_open: boolean;
}
