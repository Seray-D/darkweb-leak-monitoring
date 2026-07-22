"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import Header from "@/components/Header";
import LeakTable from "@/components/LeakTable";
import StatsCards from "@/components/StatsCards";
import { scanEmail } from "@/lib/api";
import { Leak } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function clearLeaks(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/leaks/clear`, {
        method: "DELETE",
    });
    if (!res.ok) {
        throw new Error("Veritabanı temizlenirken hata oluştu.");
    }
}

export default function Home() {
    const [leaks, setLeaks] = useState<Leak[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const didClearOnMount = useRef(false);

    // Sayfa ilk açıldığında / yenilendiğinde veritabanını sıfırla
    const resetOnMount = useCallback(async () => {
        if (didClearOnMount.current) return;
        didClearOnMount.current = true;

        try {
            setError(null);
            await clearLeaks();
            setLeaks([]);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        resetOnMount();
    }, [resetOnMount]);

    // Header veya başka yerden tetiklenen tarama işlemi
    const handleScan = async (email: string) => {
        setScanning(true);
        setError(null);
        setInfoMessage(null);

        // Yeni arama başlar başlamaz sonuçları sıfırla
        setLeaks([]);

        try {
            const result = await scanEmail(email);

            if (!result || result.length === 0) {
                setInfoMessage(
                    `"${email}" adresi için kamuya açık veritabanlarında sızıntı bulunamadı (Temiz).`
                );
                setLeaks([]);
            } else {
                setInfoMessage(
                    `"${email}" için ${result.length} adet sızıntı kaydı tespit edildi!`
                );
                setLeaks(result);
            }
        } catch (err) {
            console.error("Scan hatası:", err);
            setError(
                err instanceof Error ? err.message : "Tarama sırasında hata oluştu."
            );
            setLeaks([]);
        } finally {
            setScanning(false);
        }
    };

    // Tablo içindeki durum güncellemeleri veya tablo içi aramalar 
    // yapıldığında StatsCards'ı güncellemek için callback
    const handleLeaksUpdate = (updatedLeaks: Leak[]) => {
        setLeaks(updatedLeaks);
    };

    return (
        <main className="min-h-screen bg-[#0a0d14] text-slate-100">
            <Header
                onScan={handleScan}
                scanning={scanning}
                totalLeaks={leaks.length}
            />

            <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
                {/* İstatistik Kartları */}
                <StatsCards leaks={leaks} />

                {/* Hata Mesajı Kutusu */}
                {error && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                        <button onClick={() => setError(null)} aria-label="Kapat">
                            <X size={16} className="text-red-400/70 hover:text-red-300" />
                        </button>
                    </div>
                )}

                {/* Bilgi / Başarı Mesajı Kutusu */}
                {infoMessage && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            {infoMessage}
                        </div>
                        <button onClick={() => setInfoMessage(null)} aria-label="Kapat">
                            <X size={16} className="text-cyan-400/70 hover:text-cyan-300" />
                        </button>
                    </div>
                )}

                {/* Filtreli Tablo */}
                <LeakTable
                    leaks={leaks}
                    loading={loading || scanning}
                    onLeaksUpdate={handleLeaksUpdate}
                />
            </div>
        </main>
    );
}