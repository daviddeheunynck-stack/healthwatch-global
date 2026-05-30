"use client";

import { useState } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";

export type NewsletterLabels = {
  title:       string;
  subtitle:    string;
  placeholder: string;
  regionLabel: string;
  regions:     Record<string, string>;
  submit:      string;
  success:     string;
  successSub:  string;
  fine:        string;
  errorGeneric: string;
};

const REGIONS = ["allRegions", "africa", "asia", "europe", "americas", "oceania"] as const;

export default function NewsletterSubscribeForm({
  locale,
  labels,
}: {
  locale: string;
  labels: NewsletterLabels;
}) {
  const [email,     setEmail]     = useState("");
  const [region,    setRegion]    = useState("allRegions");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, region, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? labels.errorGeneric); return; }
      setSubmitted(true);
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-400" />
        <p className="text-lg font-semibold text-white">{labels.success}</p>
        <p className="text-sm text-gray-400">{labels.successSub}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.placeholder}
          disabled={loading}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
        />
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          disabled={loading}
          aria-label={labels.regionLabel}
          className="sm:w-44 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{labels.regions[r] ?? r}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Mail className="w-4 h-4" />
          }
          {labels.submit}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <p className="text-xs text-gray-600 text-center">{labels.fine}</p>
    </form>
  );
}
