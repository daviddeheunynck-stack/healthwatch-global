"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  citation: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function CitationBlock({ citation, label, copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);

  const today   = new Date();
  const cited   = `${today.getFullYear()} ${MONTHS[today.getMonth()]} ${String(today.getDate()).padStart(2, "0")}`;
  const full    = citation.replace("[cited YYYY Mon DD]", `[cited ${cited}]`);

  async function copy() {
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mb-6 p-4 rounded-lg border border-gray-700/40 bg-gray-800/20">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p suppressHydrationWarning className="text-[11px] text-gray-500 leading-relaxed font-mono break-all">{full}</p>
      <button
        onClick={copy}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-green-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
