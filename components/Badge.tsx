import { ShieldAlert, ShieldCheck, ShieldQuestion, CircleDot, Radar, CircleCheck } from "lucide-react";
import { BadgeVariant } from "@/lib/types";

interface BadgeProps {
    value: string;
    variant: BadgeVariant;
}

const STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
    // Certainty
    Confirmed: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: ShieldCheck },
    Verified: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: ShieldCheck },
    Unsure: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: ShieldQuestion },

    // Status
    Active: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: CircleCheck },
    Monitoring: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", icon: Radar },
    Resolved: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", icon: CircleCheck },

    // Priority
    Critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: ShieldAlert },
    High: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: ShieldAlert },
    Medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: CircleDot },
    Low: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", icon: CircleDot },
    Info: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", icon: CircleDot },
};

const DEFAULT_STYLE = { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", icon: CircleDot };

export default function Badge({ value }: BadgeProps) {
    const style = STYLES[value] ?? DEFAULT_STYLE;
    const Icon = style.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tracking-wide ${style.bg} ${style.text} ${style.border}`}
        >
            <Icon size={12} strokeWidth={2.5} />
            {value}
        </span>
    );
}
