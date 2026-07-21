"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordCell({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex items-center gap-2 font-mono text-sm text-slate-300">
      <span className="min-w-[5.5rem]">{revealed ? value : "•".repeat(Math.max(value.length, 6))}</span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="text-slate-500 transition-colors hover:text-cyan-400"
        aria-label={revealed ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
