"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, ShieldCheck, KeyRound, Radar } from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    description: string;
    icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
    {
        href: "/",
        label: "Ana Sayfa",
        description: "Canlı tarama ve sızıntı paneli",
        icon: LayoutDashboard,
    },
    {
        href: "/assets",
        label: "Varlık Yönetimi",
        description: "İzlenen domain ve e-postalar",
        icon: ShieldCheck,
    },
    {
        href: "/tools/password-checker",
        label: "Parola Güvenlik Testi",
        description: "k-Anonymity ile HIBP kontrolü",
        icon: KeyRound,
    },
];

export default function Sidebar() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Sayfa değiştiğinde (bir linke tıklanınca) sidebar'ı otomatik kapat.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Sidebar açıkken arka planın kaymasını (scroll) engelle.
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    // ESC tuşuyla kapatma desteği.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <>
            {/* Hamburger Tetikleyici */}
            <button
                onClick={() => setOpen(true)}
                aria-label="Menüyü aç"
                className={`fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-[#0a0d14]/90 text-slate-300 backdrop-blur transition hover:border-cyan-500/40 hover:text-cyan-300 ${
                    open ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
            >
                <Menu size={18} />
            </button>

            {/* Karartma / Arka Plan Örtüsü */}
            <div
                onClick={() => setOpen(false)}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
                    open ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
            />

            {/* Sidebar Paneli */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-[#0a0d14]/95 backdrop-blur-xl transition-transform duration-300 ease-out ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
                aria-hidden={!open}
            >
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
                    <div className="flex items-center gap-2.5">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                            <Radar size={18} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-tight text-slate-100">
                                Leak Monitor
                            </p>
                            <p className="text-[11px] text-slate-500">Tehdit İstihbaratı</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        aria-label="Menüyü kapat"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-200"
                    >
                        <X size={16} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                                    isActive
                                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                                        : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/60 hover:text-slate-200"
                                }`}
                            >
                                <Icon
                                    size={17}
                                    className={`mt-0.5 shrink-0 ${
                                        isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                                    }`}
                                />
                                <span>
                                    <span className="block font-medium">{item.label}</span>
                                    <span className="block text-xs text-slate-500">
                                        {item.description}
                                    </span>
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-slate-800 px-5 py-4">
                    <p className="text-[11px] leading-relaxed text-slate-600">
                        Tüm veriler yalnızca kamuya açık kaynaklardan (OSINT) pasif olarak
                        toplanır.
                    </p>
                </div>
            </aside>
        </>
    );
}
