"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import Header from "@/components/Header";
import LeakTable from "@/components/LeakTable";
import StatsCards from "@/components/StatsCards";
import { scanEmail } from "@/lib/api";
import { Leak } from "@/lib/types";

// NOT: lib/api.ts dosyanızda henüz "clearLeaks" fonksiyonu yoksa, aşağıdaki
// gibi ekleyin (mevcut fetchLeaks/scanEmail'in kullandığı base URL ile aynı
// yapıyı kullanın):
//
//   export async function clearLeaks(): Promise<void> {
//     const res = await fetch(`${API_BASE_URL}/api/v1/leaks/clear`, {
//       method: "DELETE",
//     });
//     if (!res.ok) {
//       throw new Error("Veritabanı temizlenirken hata oluştu.");
//     }
//   }
//
// Aşağıda geçici olarak, projenizin ortam değişkenine göre ayarlayabileceğiniz
// basit bir fallback fonksiyon tanımlanmıştır. lib/api.ts içine gerçek
// "clearLeaks" fonksiyonunu ekledikten sonra bu fallback'i kaldırıp
// import { fetchLeaks, scanEmail, clearLeaks } from "@/lib/api"; şeklinde
// kullanabilirsiniz.
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

    // StrictMode'da (dev ortamında) useEffect iki kez tetiklenebildiği için
    // sayfa başına yalnızca bir kez temizleme yapılmasını garanti eder.
    const didClearOnMount = useRef(false);

    // Sayfa ilk açıldığında / yenilendiğinde (F5) eski verilerin ekrana
    // dolmasını engellemek için: veritabanını sıfırla ve ekranı boş başlat.
    // Eski verileri çekmiyoruz (fetchLeaks çağrılmıyor), çünkü amaç her
    // zaman temiz bir sayfa ile başlamak.
    const resetOnMount = useCallback(async () => {
        if (didClearOnMount.current) return;
        didClearOnMount.current = true;

        try {
            setError(null);
            await clearLeaks();
            setLeaks([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        resetOnMount();
    }, [resetOnMount]);

    const handleScan = async (email: string) => {
        setScanning(true);
        setError(null);
        setInfoMessage(null);

        // Yeni arama başlar başlamaz tablo ve özet kartları sıfırla; ekranda
        // sadece bu aramanın taze sonuçları görünsün.
        setLeaks([]);

        console.log("Tarama isteği gönderiliyor:", email);

        try {
            const result = await scanEmail(email);
            console.log("Scan yanıtı:", result);

            if (!result || result.length === 0) {
                setInfoMessage(`"${email}" adresi için kamuya açık veritabanlarında yeni bir sızıntı bulunamadı (Temiz).`);
                setLeaks([]);
            } else {
                setInfoMessage(`"${email}" için ${result.length} adet yeni sızıntı kaydı tespit edildi ve veritabanına işlendi!`);
                // Backend bu taramadan önce veritabanını sıfırladığı için,
                // döndürülen "result" veritabanındaki TÜM güncel veriyle
                // birebir aynıdır; ekstra bir fetchLeaks çağrısına gerek yok.
                setLeaks(result);
            }
        } catch (err) {
            console.error("Scan hatası:", err);
            setError(err instanceof Error ? err.message : "Tarama sırasında hata oluştu.");
            setLeaks([]);
        } finally {
            setScanning(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#0a0d14] text-slate-100">
            <Header onScan={handleScan} scanning={scanning} totalLeaks={leaks.length} />

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
                <LeakTable leaks={leaks} loading={loading} />
            </div>
        </main>
    );
}
