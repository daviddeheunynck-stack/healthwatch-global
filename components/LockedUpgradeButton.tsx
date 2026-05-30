"use client";

import { Lock } from "lucide-react";
import { useUpgradeModal, type UpgradeFeature } from "@/lib/upgrade-modal-context";

interface Props {
  feature: UpgradeFeature;
  label: string;
  /** Visual variant: "inline" (small text link) or "banner" (amber pill button) */
  variant?: "inline" | "banner";
}

export default function LockedUpgradeButton({ feature, label, variant = "inline" }: Props) {
  const { openModal } = useUpgradeModal();

  if (variant === "banner") {
    return (
      <button
        onClick={() => openModal(feature)}
        className="shrink-0 text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={() => openModal(feature)}
      className="flex items-center gap-2 text-xs text-amber-600/80 hover:text-amber-400 transition-colors"
    >
      <Lock className="w-3 h-3 shrink-0" />
      {label}
    </button>
  );
}
