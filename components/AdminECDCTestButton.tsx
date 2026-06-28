"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";

export default function AdminECDCTestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-ecdc");
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
        {loading ? "Scraping ECDC… (60s max)" : "Tester scraper ECDC"}
      </button>
      {result && (
        <pre className="text-xs text-gray-300 bg-gray-950 border border-gray-700 rounded-lg p-3 overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
          {result}
        </pre>
      )}
    </div>
  );
}
