import { Leak } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export async function fetchLeaks(): Promise<Leak[]> {
  const res = await fetch(`${API_BASE}/api/v1/leaks`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sızıntı verileri alınamadı (${res.status})`);
  }
  return res.json();
}

export async function scanEmail(email: string): Promise<Leak[]> {
  const res = await fetch(
    `${API_BASE}/api/v1/scan?email=${encodeURIComponent(email)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Tarama başarısız oldu (${res.status})`);
  }
  return res.json();
}
