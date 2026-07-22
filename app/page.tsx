"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AlertTriangle, CheckCircle2, X, RefreshCw, ShieldPlus, ShieldCheck, Trash2, Copy } from "lucide-react";
import Header from "@/components/Header";
import LeakTable from "@/components/LeakTable";
import StatsCards from "@/components/StatsCards";
import { scanEmail, addMonitoredAsset, getMonitoredAssets, deleteMonitoredAsset, rescanMonitoredAsset, verifyMonitoredAsset } from "@/lib/api";
import { Leak, MonitoredAsset } from "@/lib/types";

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

    // İzlemeye Ekle butonu, en son aratılan hedefe (e-posta/domain) göre çalışır
    const [currentTarget, setCurrentTarget] = useState<string | null>(null);
    const [addingToMonitoring, setAddingToMonitoring] = useState(false);

    // İzlenen Varlıklar (Monitored Assets) paneli
    const [showMonitored, setShowMonitored] = useState(false);
    const [monitoredAssets, setMonitoredAssets] = useState<MonitoredAsset[]>([]);
    const [monitoredLoading, setMonitoredLoading] = useState(false);
    const [monitoredError, setMonitoredError] = useState<string | null>(null);

    // Yeniden tarama durumu
    const [rescanningId, setRescanningId] = useState<number | null>(null);

    // Domain Sahiplik Doğrulaması (DNS TXT Verification) durumu
    const [verifyingId, setVerifyingId] = useState<number | null>(null);
    const [copiedAssetId, setCopiedAssetId] = useState<number | null>(null);

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
        setCurrentTarget(email.trim());

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

    // En son aratılan hedefi (currentTarget) izleme listesine ekler ve anında tarar
    const handleAddToMonitoring = async () => {
        if (!currentTarget) return;

        setAddingToMonitoring(true);
        setError(null);
        try {
            // 1. Varlığı izlemeye ekle
            const newAsset = await addMonitoredAsset(currentTarget);
            setInfoMessage(`"${currentTarget}" izleme listesine eklendi. Sızıntılar taranıyor...`);

            // 2. Anında ilk taramasını başlat ki sızıntı sayısı 0 kalmasın
            const updated = await rescanMonitoredAsset(newAsset.id);

            if (showMonitored) {
                await loadMonitoredAssets();
            } else {
                setMonitoredAssets((prev) => [...prev, updated]);
            }

            if (updated.breach_logs) {
                setLeaks(updated.breach_logs);
            }

            setInfoMessage(`"${currentTarget}" izlemeye eklendi ve sızıntı geçmişi güncellendi.`);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "İzlemeye eklenirken hata oluştu."
            );
        } finally {
            setAddingToMonitoring(false);
        }
    };

    const loadMonitoredAssets = useCallback(async () => {
        setMonitoredLoading(true);
        setMonitoredError(null);
        try {
            const data = await getMonitoredAssets();
            setMonitoredAssets(data);
        } catch (err) {
            setMonitoredError(
                err instanceof Error ? err.message : "İzlenen varlıklar alınamadı."
            );
        } finally {
            setMonitoredLoading(false);
        }
    }, []);

    const handleToggleMonitored = () => {
        const next = !showMonitored;
        setShowMonitored(next);
        if (next) {
            loadMonitoredAssets();
        }
    };

    const handleRemoveMonitored = async (id: number) => {
        try {
            await deleteMonitoredAsset(id);
            setMonitoredAssets((prev) => prev.filter((asset) => asset.id !== id));
        } catch (err) {
            setMonitoredError(
                err instanceof Error ? err.message : "Kaldırılırken hata oluştu."
            );
        }
    };

    const handleRescanMonitored = async (id: number) => {
        setRescanningId(id);
        setMonitoredError(null);
        try {
            const updated = await rescanMonitoredAsset(id);
            setMonitoredAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));

            if (updated.breach_logs) {
                setLeaks(updated.breach_logs);
            }
        } catch (err) {
            setMonitoredError(
                err instanceof Error ? err.message : "Yeniden tarama sırasında hata oluştu."
            );
        } finally {
            setRescanningId(null);
        }
    };

    // "Doğrula" butonu: DNS TXT kaydını backend'e doğrulatır.
    const handleVerifyMonitored = async (id: number) => {
        setVerifyingId(id);
        setMonitoredError(null);
        try {
            const result = await verifyMonitoredAsset(id);
            setMonitoredAssets((prev) =>
                prev.map((asset) =>
                    asset.id === id ? { ...asset, is_verified: true } : asset
                )
            );
            setInfoMessage(
                result.detail ||
                `"${result.target ?? ""}" domaini başarıyla doğrulandı.`
            );
        } catch (err) {
            setMonitoredError(
                err instanceof Error ? err.message : "Domain doğrulanırken hata oluştu."
            );
        } finally {
            setVerifyingId(null);
        }
    };

    // TXT kaydı metnini panoya kopyalar ve kısa süreliğine geri bildirim gösterir.
    const handleCopyToken = async (assetId: number, token: string) => {
        try {
            await navigator.clipboard.writeText(`leak-monitor-verify=${token}`);
            setCopiedAssetId(assetId);
            setTimeout(() => setCopiedAssetId((prev) => (prev === assetId ? null : prev)), 2000);
        } catch (err) {
            setMonitoredError("Panoya kopyalanamadı, lütfen manuel seçip kopyalayın.");
        }
    };

    return (
        <main className="min-h-screen bg-[#0a0d14] text-slate-100">
            <Header
                onScan={handleScan}
                scanning={scanning}
                totalLeaks={leaks.length}
            />

            <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
                {/* Araç Çubuğu: İzlenen Varlıklar / İzlemeye Ekle */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={handleToggleMonitored}
                        className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                    >
                        {showMonitored ? "İzlenen Varlıkları Gizle" : "İzlenen Varlıklar"}
                        {monitoredAssets.length > 0 && ` (${monitoredAssets.length})`}
                    </button>

                    {currentTarget && !loading && !scanning && (
                        <button
                            onClick={handleAddToMonitoring}
                            disabled={addingToMonitoring}
                            className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ShieldPlus size={15} />
                            {addingToMonitoring
                                ? "Ekleniyor & Taranıyor..."
                                : `"${currentTarget}" için İzlemeye Ekle`}
                        </button>
                    )}
                </div>

                {/* İzlenen Varlıklar Paneli */}
                {showMonitored && (
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-slate-200">
                            İzlenen Varlıklar
                        </h2>

                        {monitoredError && (
                            <p className="text-sm text-red-400">{monitoredError}</p>
                        )}

                        {monitoredLoading ? (
                            <p className="text-sm text-slate-400">Yükleniyor...</p>
                        ) : monitoredAssets.length === 0 ? (
                            <p className="text-sm text-slate-400">
                                Henüz izlenen bir varlık yok. Arama yaptıktan sonra
                                &quot;İzlemeye Ekle&quot; butonuyla ekleyebilirsiniz.
                            </p>
                        ) : (
                            <ul className="divide-y divide-slate-800">
                                {monitoredAssets.map((asset) => {
                                    const needsVerification =
                                        asset.asset_type === "domain" && !asset.is_verified;

                                    return (
                                        <li key={asset.id} className="py-2.5 space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm text-slate-100">
                                                        {asset.target}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {asset.asset_type === "email" ? "E-posta" : "Domain"}
                                                        {" · "}
                                                        {asset.breach_logs.length} sızıntı kaydı
                                                        {" · "}
                                                        {asset.is_verified ? "Doğrulandı" : "Doğrulanmadı"}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {needsVerification && (
                                                        <button
                                                            onClick={() => handleVerifyMonitored(asset.id)}
                                                            disabled={verifyingId === asset.id}
                                                            aria-label={`${asset.target} domainini doğrula`}
                                                            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <ShieldCheck
                                                                size={13}
                                                                className={verifyingId === asset.id ? "animate-spin" : ""}
                                                            />
                                                            {verifyingId === asset.id ? "Doğrulanıyor..." : "Doğrula"}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleRescanMonitored(asset.id)}
                                                        disabled={rescanningId === asset.id}
                                                        aria-label={`${asset.target} için şimdi tara`}
                                                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <RefreshCw size={13} className={rescanningId === asset.id ? "animate-spin" : ""} />
                                                        {rescanningId === asset.id ? "Taranıyor..." : "Şimdi Tara"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveMonitored(asset.id)}
                                                        aria-label={`${asset.target} izlemeden kaldır`}
                                                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 size={13} />
                                                        Kaldır
                                                    </button>
                                                </div>
                                            </div>

                                            {needsVerification && (
                                                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                                                    <code className="flex-1 min-w-0 truncate text-xs text-amber-300">
                                                        DNS TXT Kaydı: leak-monitor-verify={asset.verification_token}
                                                    </code>
                                                    <button
                                                        onClick={() => handleCopyToken(asset.id, asset.verification_token)}
                                                        aria-label={`${asset.target} için TXT kaydını kopyala`}
                                                        className="flex shrink-0 items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                                                    >
                                                        <Copy size={12} />
                                                        {copiedAssetId === asset.id ? "Kopyalandı" : "Kopyala"}
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

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