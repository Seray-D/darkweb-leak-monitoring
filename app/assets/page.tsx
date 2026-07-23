"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    ShieldPlus,
    ShieldCheck,
    RefreshCw,
    Trash2,
    Copy,
    Check,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    X,
    Globe2,
    Mail,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import {
    getMonitoredAssets,
    addMonitoredAsset,
    deleteMonitoredAsset,
    rescanMonitoredAsset,
    verifyMonitoredAsset,
} from "@/lib/api";
import { MonitoredAsset } from "@/lib/types";

export default function AssetsPage() {
    const [assets, setAssets] = useState<MonitoredAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    // Yeni varlık ekleme formu
    const [newTarget, setNewTarget] = useState("");
    const [adding, setAdding] = useState(false);

    // Satır bazlı işlem durumları
    const [rescanningId, setRescanningId] = useState<number | null>(null);
    const [verifyingId, setVerifyingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [copiedAssetId, setCopiedAssetId] = useState<number | null>(null);

    const loadAssets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getMonitoredAssets();
            setAssets(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "İzlenen varlıklar alınamadı."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = newTarget.trim();
        if (!cleaned || adding) return;

        setAdding(true);
        setError(null);
        setInfoMessage(null);
        try {
            const newAsset = await addMonitoredAsset(cleaned);
            setInfoMessage(`"${cleaned}" izleme listesine eklendi. İlk tarama başlatılıyor...`);

            // Sızıntı sayısı 0 kalmasın diye anında ilk taramayı da tetikle.
            const updated = await rescanMonitoredAsset(newAsset.id);
            setAssets((prev) => [updated, ...prev]);
            setNewTarget("");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "İzlemeye eklenirken hata oluştu."
            );
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (id: number, target: string) => {
        setDeletingId(id);
        setError(null);
        try {
            await deleteMonitoredAsset(id);
            setAssets((prev) => prev.filter((asset) => asset.id !== id));
            setInfoMessage(`"${target}" izleme listesinden kaldırıldı.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Kaldırılırken hata oluştu.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleRescan = async (id: number) => {
        setRescanningId(id);
        setError(null);
        try {
            const updated = await rescanMonitoredAsset(id);
            setAssets((prev) => prev.map((asset) => (asset.id === id ? updated : asset)));
            setInfoMessage(
                `"${updated.target}" yeniden tarandı — ${updated.breach_logs.length} kayıt.`
            );
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Yeniden tarama sırasında hata oluştu."
            );
        } finally {
            setRescanningId(null);
        }
    };

    // "Doğrula" butonu: DNS TXT kaydını backend'e doğrulatır.
    const handleVerify = async (id: number) => {
        setVerifyingId(id);
        setError(null);
        try {
            const result = await verifyMonitoredAsset(id);
            setAssets((prev) =>
                prev.map((asset) =>
                    asset.id === id ? { ...asset, is_verified: true } : asset
                )
            );
            setInfoMessage(
                result.detail || `"${result.target ?? ""}" domaini başarıyla doğrulandı.`
            );
        } catch (err) {
            setError(
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
            setTimeout(
                () => setCopiedAssetId((prev) => (prev === assetId ? null : prev)),
                2000
            );
        } catch {
            setError("Panoya kopyalanamadı, lütfen manuel seçip kopyalayın.");
        }
    };

    return (
        <main className="min-h-screen bg-[#0a0d14] text-slate-100">
            <Sidebar />

            <div className="mx-auto max-w-6xl px-6 py-8 pl-16 space-y-6 lg:pl-6">
                {/* Üst Navigasyon */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
                    >
                        <ArrowLeft size={15} />
                        Panele Dön
                    </Link>
                    <button
                        onClick={loadAssets}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                        Listeyi Yenile
                    </button>
                </div>

                {/* Başlık */}
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-semibold text-slate-100">
                        Varlık Yönetimi
                    </h1>
                    <p className="text-sm text-slate-400">
                        İzlemeye aldığınız domain ve e-postaları buradan yönetin; sahiplik
                        doğrulaması yapın, yeniden tarayın veya listeden kaldırın.
                    </p>
                </div>

                {/* Yeni Varlık Ekleme Formu */}
                <form
                    onSubmit={handleAdd}
                    className="flex flex-col gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-4 sm:flex-row sm:items-center"
                >
                    <input
                        type="text"
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        placeholder="Domain veya e-posta ekle (ör. example.com)"
                        className="flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500/60"
                    />
                    <button
                        type="submit"
                        disabled={adding || !newTarget.trim()}
                        className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {adding ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <ShieldPlus size={15} />
                        )}
                        {adding ? "Ekleniyor & Taranıyor..." : "İzlemeye Ekle"}
                    </button>
                </form>

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

                {/* Varlık Tablosu */}
                <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/40">
                    {loading ? (
                        <p className="px-4 py-6 text-sm text-slate-400">Yükleniyor...</p>
                    ) : assets.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-400">
                            Henüz izlenen bir varlık yok. Yukarıdaki formdan domain veya
                            e-posta ekleyebilirsiniz.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-3 font-medium">Hedef</th>
                                        <th className="px-4 py-3 font-medium">Tür</th>
                                        <th className="px-4 py-3 font-medium">Sızıntı</th>
                                        <th className="px-4 py-3 font-medium">Doğrulama</th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            İşlemler
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {assets.map((asset) => {
                                        const needsVerification =
                                            asset.asset_type === "domain" && !asset.is_verified;
                                        const TypeIcon =
                                            asset.asset_type === "email" ? Mail : Globe2;

                                        return (
                                            <Fragment key={asset.id}>
                                                <tr className="align-top">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-100">
                                                            {asset.target}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Eklendi:{" "}
                                                            {new Date(
                                                                asset.created_at
                                                            ).toLocaleDateString("tr-TR")}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                                                            <TypeIcon size={13} />
                                                            {asset.asset_type === "email"
                                                                ? "E-posta"
                                                                : "Domain"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-slate-300">
                                                            {asset.breach_logs.length}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {" "}
                                                            kayıt
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {asset.asset_type === "email" ? (
                                                            <span className="text-xs text-slate-500">
                                                                —
                                                            </span>
                                                        ) : asset.is_verified ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                                                                <ShieldCheck size={11} />
                                                                Doğrulandı
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                                                                Doğrulanmadı
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-end gap-3">
                                                            {needsVerification && (
                                                                <button
                                                                    onClick={() => handleVerify(asset.id)}
                                                                    disabled={verifyingId === asset.id}
                                                                    aria-label={`${asset.target} domainini doğrula`}
                                                                    className="flex items-center gap-1 text-xs text-amber-400 transition hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    <ShieldCheck
                                                                        size={13}
                                                                        className={
                                                                            verifyingId === asset.id
                                                                                ? "animate-spin"
                                                                                : ""
                                                                        }
                                                                    />
                                                                    {verifyingId === asset.id
                                                                        ? "Doğrulanıyor..."
                                                                        : "Doğrula"}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleRescan(asset.id)}
                                                                disabled={rescanningId === asset.id}
                                                                aria-label={`${asset.target} için şimdi tara`}
                                                                className="flex items-center gap-1 text-xs text-cyan-400 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                <RefreshCw
                                                                    size={13}
                                                                    className={
                                                                        rescanningId === asset.id
                                                                            ? "animate-spin"
                                                                            : ""
                                                                    }
                                                                />
                                                                {rescanningId === asset.id
                                                                    ? "Taranıyor..."
                                                                    : "Tara"}
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleRemove(asset.id, asset.target)
                                                                }
                                                                disabled={deletingId === asset.id}
                                                                aria-label={`${asset.target} izlemeden kaldır`}
                                                                className="flex items-center gap-1 text-xs text-red-400 transition hover:text-red-300 disabled:opacity-50"
                                                            >
                                                                <Trash2 size={13} />
                                                                {deletingId === asset.id
                                                                    ? "Kaldırılıyor..."
                                                                    : "Kaldır"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {needsVerification && (
                                                    <tr>
                                                        <td colSpan={5} className="bg-slate-950/40 px-4 py-3">
                                                            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                                                                <code className="min-w-0 flex-1 truncate text-xs text-amber-300">
                                                                    DNS TXT Kaydı: leak-monitor-verify=
                                                                    {asset.verification_token}
                                                                </code>
                                                                <button
                                                                    onClick={() =>
                                                                        handleCopyToken(
                                                                            asset.id,
                                                                            asset.verification_token
                                                                        )
                                                                    }
                                                                    aria-label={`${asset.target} için TXT kaydını kopyala`}
                                                                    className="flex shrink-0 items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                                                                >
                                                                    {copiedAssetId === asset.id ? (
                                                                        <Check size={12} />
                                                                    ) : (
                                                                        <Copy size={12} />
                                                                    )}
                                                                    {copiedAssetId === asset.id
                                                                        ? "Kopyalandı"
                                                                        : "Kopyala"}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
