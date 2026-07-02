"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import UpgradeModal from "@/components/UpgradeModal";

export type UpgradeFeature = "pdf" | "realtime" | "list" | "cases" | "csv" | "compare" | "watchlist";

interface UpgradeModalContextType {
  openModal: (feature: UpgradeFeature) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType>({
  openModal: () => {},
});

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<UpgradeFeature | null>(null);

  return (
    <UpgradeModalContext.Provider value={{ openModal: setFeature }}>
      {children}
      {feature !== null && (
        <UpgradeModal feature={feature} onClose={() => setFeature(null)} />
      )}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  return useContext(UpgradeModalContext);
}
