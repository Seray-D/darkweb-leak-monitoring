"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Radio, Trash2, Wifi, WifiOff } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FeedEventType =
    | "scan_start"
    | "scan_complete"
    | "service_query"
    | "service_result"
    | "service_error"
    | "leak_found";

interface FeedEvent {
    type: FeedEventType;
    message: string;
    timestamp: number;
    service?: string;
    target?: string;
    count?: number;
    source?: string;
    leak_type?: string;
}

const TYPE_STYLES: Record<FeedEventType, string> = {
    scan_start: "text-cyan-300",
    scan_complete: "text-cyan-400",
    service_query: "text-slate-400",
    service_result: "text-slate-300",
    service_error: "text-red-400",
    leak_found: "text-amber-300",
};

const TYPE_LABELS: Record<FeedEventType, string> = {
    scan_start: "TARAMA",
    scan_complete: "TAMAMLANDI",
    service_query: "SORGU",
    service_result: "SONUÇ",
    service_error: "HATA",
    leak_found: "SIZINTI",
};

function formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString("tr-TR", { hour12: false });
}

export default function LiveFeedPage() {
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const logEndRef = useRef<HTMLDivElement>(null);

    // SSE bağlantısı: sayfa açık kaldığı sürece backend'ten gelen tüm
    // tarama olaylarını dinler. EventSource kendi kendine yeniden bağlanır.
    useEffect(() => {
        const es = new EventSource(`${API_BASE_URL}/api/v1/live-feed/stream`);

        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false);

        es.addEventListener("leak-feed", (e: MessageEvent) => {
            try {
                const parsed: FeedEvent = JSON.parse(e.data);
                setEvents((prev) => [...prev.slice(-499), parsed]);
            } catch {
                // Bozuk JSON gelirse sessizce yoksay.
            }
        });

        return () => es.close();
    }, []);

    useEffect(() => {
        if (autoScroll) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [events, autoScroll]);

    return (
        <main className="min-h-screen bg-[#0a0d14] text-slate-100">
            <Sidebar />

            <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
                <div className="flex items-center justify-between gap-3 pl-12">
                    <div>
                        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                            <Radio size={18} className="text-cyan-400" />
                            Canlı Tehdit Akışı
                        </h1>
                        <p className="text-xs text-slate-500">
                            LeakIX, OTX, XposedOrNot ve BreachDirectory sorgularının anlık akışı
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${connected
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : "border-red-500/30 bg-red-500/10 text-red-400"
                                }`}
                        >
                            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {connected ? "Bağlı" : "Bağlantı kesildi"}
                        </span>

                        <button
                            onClick={() => setEvents([])}
                            className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
                        >
                            <Trash2 size={12} />
                            Temizle
                        </button>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-black/40">
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
                        <div className="flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            <input
                                type="checkbox"
                                checked={autoScroll}
                                onChange={(e) => setAutoScroll(e.target.checked)}
                                className="accent-cyan-500"
                            />
                            Otomatik kaydır
                        </label>
                    </div>

                    <div className="h-[65vh] overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
                        {events.length === 0 ? (
                            <p className="text-slate-600">
                                Henüz olay yok. Bir tarama başlattığınızda burada anlık olarak görünecek...
                            </p>
                        ) : (
                            events.map((ev, idx) => (
                                <div key={idx} className="flex gap-2 whitespace-pre-wrap break-all">
                                    <span className="shrink-0 text-slate-600">
                                        {formatTime(ev.timestamp)}
                                    </span>
                                    <span className={`shrink-0 font-semibold ${TYPE_STYLES[ev.type] ?? "text-slate-300"}`}>
                                        [{TYPE_LABELS[ev.type] ?? ev.type.toUpperCase()}]
                                    </span>
                                    <span className="text-slate-300">{ev.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </main>
    );
}