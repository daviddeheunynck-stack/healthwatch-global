"use client";

import { useState } from "react";
import { Link2, Link2Off, Loader2, CheckCircle, Lock } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlackWebhookLabels {
  title: string;
  desc: string;
  placeholder: string;
  save: string;
  remove: string;
  connected: string;
  connectedDesc: string;
  locked: string;
  upgrade: string;
  upgradeHref: string;
  errorInvalid: string;
  errorGeneric: string;
  howTo: string;
  howToHref: string;
}

interface Props {
  isPaid: boolean;
  initialConfigured: boolean;
  initialMasked: string | null;
  labels: SlackWebhookLabels;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SlackWebhookForm({
  isPaid,
  initialConfigured,
  initialMasked,
  labels: l,
}: Props) {
  const [configured, setConfigured] = useState(initialConfigured);
  const [masked,     setMasked]     = useState(initialMasked);
  const [url,        setUrl]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  const save = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/slack-webhook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.includes("Invalid") ? l.errorInvalid : l.errorGeneric);
        return;
      }

      setConfigured(true);
      setMasked(`${url.slice(0, 30)}…${url.slice(-6)}`);
      setUrl("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError(l.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      await fetch("/api/slack-webhook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      });
      setConfigured(false);
      setMasked(null);
      setUrl("");
    } catch {
      setError(l.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  // ── Free user gate ──────────────────────────────────────────────────────────
  if (!isPaid) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-sm text-gray-400 flex-1">{l.locked}</p>
        <Link
          href={l.upgradeHref}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
        >
          {l.upgrade} →
        </Link>
      </div>
    );
  }

  // ── Connected state ─────────────────────────────────────────────────────────
  if (configured) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/10">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-300">{l.connected}</p>
            {masked && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{masked}</p>
            )}
          </div>
          <button
            onClick={remove}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2Off className="w-3.5 h-3.5" />
            )}
            {l.remove}
          </button>
        </div>
        <p className="text-xs text-gray-500">{l.connectedDesc}</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ── Setup form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder={l.placeholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          onClick={save}
          disabled={!url.trim() || loading}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
          {l.save}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400">{l.connected} ✓</p>}

      <a
        href={l.howToHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2"
      >
        {l.howTo}
      </a>
    </div>
  );
}
