import {
    ShieldAlert,
    ShieldCheck,
    ShieldQuestion,
    CircleDot,
    CircleCheck,
    CircleSlash,
    Radar,
    Loader2,
} from "lucide-react";
import { BadgeVariant } from "@/lib/types";

interface BadgeProps {
    value: string;
    variant: BadgeVariant;
}

interface BadgeStyle {
    bg: string;
    text: string;
    border: string;
    icon: React.ElementType;
}

// Anahtar `${variant}:${value}` şeklinde — certainty/status/priority
// arasında aynı isimli bir değer olsa bile (ör. ileride ortak bir "Critical"
// eklenirse) yanlış varyanttan stil çekilmesini engeller.
const STYLES: Record<string, BadgeStyle> = {
    // --- Certainty ---
    "certainty:Confirmed": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: ShieldAlert },
    "certainty:Verified": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: ShieldCheck },
    "certainty:Unsure": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: ShieldQuestion },
    "certainty:False Positive": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: CircleSlash },

    // --- Status ---
    // NOT: "Active" = henüz kapatılmamış / devam eden risk anlamına
    // geldiği için kırmızı; "Resolved"/"Completed" kapanmış vaka olduğu
    // için sakin (emerald) renkte. Önceki sürümde tam tersiydi.
    "status:Active": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: ShieldAlert },
    "status:In Progress": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: Loader2 },
    "status:Monitoring": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", icon: Radar },
    "status:Resolved": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: CircleCheck },
    "status:Completed": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: CircleCheck },
    "status:Ignored": { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", icon: CircleSlash },

    // --- Priority ---
    "priority:Critical": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: ShieldAlert },
    "priority:High": { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", icon: ShieldAlert },
    "priority:Medium": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: CircleDot },
    "priority:Low": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", icon: CircleDot },
    "priority:Info": { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", icon: CircleDot },
};

const DEFAULT_STYLE: BadgeStyle = {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    icon: CircleDot,
};

export default function Badge({ value, variant }: BadgeProps) {
    const style = STYLES[`${variant}:${value}`] ?? DEFAULT_STYLE;
    const Icon = style.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tracking-wide ${style.bg} ${style.text} ${style.border}`}
        >
            <Icon size={12} strokeWidth={2.5} />
            {value || "-"}
        </span>
    );
}
