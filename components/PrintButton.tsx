"use client";
import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors shrink-0 print:hidden"
    >
      <Printer className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
