"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    KeyRound,
    Eye,
    EyeOff,
    ShieldCheck,
    ShieldAlert,
    Loader2,
    Lock,
    AlertTriangle,
    X,
} from "lucide-react";
import { checkPassword } from "@/lib/api";
import { PwnedPasswordResult } from "@/lib/types";
import Sidebar from "@/components/Sidebar";

export default function PasswordCheckerPage() {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<PwnedPasswordResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async () => {
        if (!password) return;

        setChecking(true);
        setError(null);
        setResult(null);

        try {
            const res = await checkPassword(password);
            setResult(res);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Parola kontrolü sırasında bir hata oluştu."
            );
        } finally {
            setChecking(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleCheck();
    };

    const handleReset = () => {
        setPassword("");
        setResult(null);
        setError(null);
    };

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-200">
            <Sidebar />
            <div className="mx-auto max-w-xl space-y-6 pl-8 lg:pl-0">
                {/* Üst Navigasyon */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
                >
                    <ArrowLeft size={15} />
                    Panele Dön
                </Link>

                {/* Başlık */}
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-400">
                        <Lock size={12} className="text-cyan-400" />
                        k-Anonymity · Sıfır Bilgi Sızıntısı
                    </div>
                    <h1 className="text-2xl font-semibold text-slate-100">
                        Parola Güvenliği Kontrolü
                    </h1>
                    <p className="text-sm leading-relaxed text-slate-400">
                        Parolanız hiçbir zaman açık metin olarak ağa gönderilmez. Kontrol,
                        parolanızın SHA-1 özetinin (hash) yalnızca ilk 5 karakteri
                        kullanılarak{" "}
                        <span className="text-slate-300">Have I Been Pwned</span>{" "}
                        veritabanına karşı, tarayıcınızda çalışır.
                    </p>
                </div>

                {/* Form Kartı */}
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4 rounded-lg border border-slate-700/50 bg-slate-900/40 p-5"
                >
                    <div className="space-y-1.5">
                        <label
                            htmlFor="password-input"
                            className="text-xs font-medium uppercase tracking-wide text-slate-500"
                        >
                            Kontrol Edilecek Parola
                        </label>
                        <div className="relative">
                            <KeyRound
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            />
                            <input
                                id="password-input"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setResult(null);
                                    setError(null);
                                }}
                                placeholder="Parolanızı girin"
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full rounded-md border border-slate-700 bg-slate-950/60 py-2.5 pl-9 pr-10 text-sm text-slate-100 outline-none transition focus:border-cyan-500/60"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            disabled={!password || checking}
                            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {checking ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <ShieldCheck size={15} />
                            )}
                            {checking ? "Kontrol Ediliyor..." : "Parolayı Kontrol Et"}
                        </button>

                        {(password || result) && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="rounded-md border border-slate-700 px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
                            >
                                Temizle
                            </button>
                        )}
                    </div>
                </form>

                {/* Hata Kutusu */}
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

                {/* Sonuç Kutusu */}
                {result && (
                    <div
                        className={
                            result.pwned
                                ? "space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-4"
                                : "space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-4"
                        }
                    >
                        <div className="flex items-center gap-2.5">
                            {result.pwned ? (
                                <ShieldAlert size={20} className="shrink-0 text-red-400" />
                            ) : (
                                <ShieldCheck size={20} className="shrink-0 text-emerald-400" />
                            )}
                            <p
                                className={
                                    result.pwned
                                        ? "text-sm font-semibold text-red-300"
                                        : "text-sm font-semibold text-emerald-300"
                                }
                            >
                                {result.pwned
                                    ? "Bu parola sızıntı veritabanlarında bulundu!"
                                    : "Bu parola bilinen sızıntılarda bulunamadı."}
                            </p>
                        </div>

                        <p
                            className={
                                result.pwned
                                    ? "text-xs leading-relaxed text-red-300/80"
                                    : "text-xs leading-relaxed text-emerald-300/80"
                            }
                        >
                            {result.pwned ? (
                                <>
                                    Bu parola, geçmişte açığa çıkan veri sızıntılarında{" "}
                                    <span className="font-semibold">
                                        {result.count.toLocaleString("tr-TR")}
                                    </span>{" "}
                                    kez tespit edilmiş. Bu parolayı kullanıyorsanız, hemen
                                    değiştirmenizi ve aynı parolayı başka hiçbir hesapta
                                    kullanmamanızı öneririz.
                                </>
                            ) : (
                                "Bu, parolanın kırılamaz olduğu anlamına gelmez; yine de güçlü ve benzersiz bir parola kullanmaya devam edin."
                            )}
                        </p>
                    </div>
                )}

                {/* Bilgilendirme: Yöntem Açıklaması */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
                    <p className="text-xs leading-relaxed text-slate-500">
                        <span className="font-medium text-slate-400">Nasıl çalışır?</span>{" "}
                        Parolanızın SHA-1 özeti tarayıcınızda hesaplanır; sunucuya yalnızca
                        özetin ilk 5 karakteri (ön ek) gönderilir. Backend bu ön eke uyan
                        tüm eşleşmeleri Have I Been Pwned&apos;dan alıp size döner; kalan
                        karakterlerle eşleşme kontrolü yine tarayıcınızda yapılır. Parolanızın
                        tamamı hiçbir zaman ağ üzerinden iletilmez.
                    </p>
                </div>
            </div>
        </main>
    );
}
