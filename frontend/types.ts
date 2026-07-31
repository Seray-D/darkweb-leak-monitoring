export interface Leak {
  id: number;
  asset: string;
  email_leak: string;
  leaked_password: string;
  leak_type: string;
  market: string;
  last_seen: string;
  certainty: "Unsure" | "Confirmed" | "Verified" | string;
  status: "Active" | "Resolved" | "Monitoring" | string;
  priority: "Info" | "Low" | "Medium" | "High" | "Critical" | string;
  discovery_date: string;
}

export type BadgeVariant = "certainty" | "status" | "priority";
