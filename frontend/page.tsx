"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import Header from "@/components/Header";
import LeakTable from "@/components/LeakTable";
import { fetchLeaks, scanEmail } from "@/lib/api";
import { Leak } from "@/lib/types";

export default function Home() {
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeaks = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchLeaks();
      setLeaks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaks();
  }, [loadLeaks]);

  const handleScan = async (email: string) => {
    setScanning(true);
    setError(null);
    try {
      await scanEmail(email);
      await loadLeaks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarama sırasında hata oluştu.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0d14]">
      <Header onScan={handleScan} scanning={scanning} totalLeaks={leaks.length} />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
            <button onClick={() => setError(null)} aria-label="Kapat">
              <X size={16} className="text-red-400/70 hover:text-red-300" />
            </button>
          </div>
        )}

        <LeakTable leaks={leaks} loading={loading} />
      </div>
    </main>
  );
}
