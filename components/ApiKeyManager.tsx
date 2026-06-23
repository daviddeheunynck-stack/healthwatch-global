"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check, Loader2, Eye, EyeOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiKeyLabels {
  title: string;
  desc: string;
  newKeyPlaceholder: string;
  create: string;
  revoke: string;
  revokeConfirm: string;
  copyKey: string;
  copied: string;
  oneTimeWarning: string;
  neverSeen: string;
  noKeys: string;
  lastUsed: string;
  never: string;
  created: string;
  errorName: string;
  errorLimit: string;
  errorGeneric: string;
  docsHint: string;
}

interface Props {
  initialKeys: ApiKey[];
  labels: ApiKeyLabels;
  locale: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApiKeyManager({ initialKeys, labels: l, locale }: Props) {
  const localeTag = locale === "ar" ? "ar-SA" : locale;
  const [keys,     setKeys]     = useState<ApiKey[]>(initialKeys);
  const [name,     setName]     = useState("");
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  // Newly created key — shown inline, one-time only
  const [newKey,    setNewKey]    = useState<string | null>(null);
  const [showKey,   setShowKey]   = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  // ── Create ──────────────────────────────────────────────────────────────────
  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    setNewKey(null);

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422) setError(l.errorLimit);
        else setError(data.error ?? l.errorGeneric);
        return;
      }

      setNewKey(data.key);
      setShowKey(true);
      setName("");

      // Refresh list
      const listRes  = await fetch("/api/api-keys");
      const listData = await listRes.json();
      setKeys(listData.keys ?? []);
    } catch {
      setError(l.errorGeneric);
    } finally {
      setCreating(false);
    }
  };

  // ── Revoke ──────────────────────────────────────────────────────────────────
  const revoke = async (id: string) => {
    if (!confirm(l.revokeConfirm)) return;
    setRevoking(id);
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (newKey) setNewKey(null);
    } catch {
      setError(l.errorGeneric);
    } finally {
      setRevoking(null);
    }
  };

  // ── Copy key ─────────────────────────────────────────────────────────────────
  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* One-time key display */}
      {newKey && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
            {l.oneTimeWarning}
          </p>
          <div className="flex items-center gap-2">
            <code className={`flex-1 font-mono text-sm text-white bg-gray-950 rounded-lg px-3 py-2 overflow-x-auto ${!showKey ? "blur-sm select-none" : ""}`}>
              {newKey}
            </code>
            <button
              onClick={() => setShowKey((s) => !s)}
              className="p-2 text-gray-400 hover:text-white transition-colors shrink-0"
              aria-label="Toggle visibility"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={copyKey}
              className="p-2 text-gray-400 hover:text-white transition-colors shrink-0"
              aria-label="Copy"
            >
              {keyCopied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-amber-600">{l.neverSeen}</p>
        </div>
      )}

      {/* Create form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          placeholder={l.newKeyPlaceholder}
          maxLength={64}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          onClick={create}
          disabled={!name.trim() || creating}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {l.create}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">{l.noKeys}</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-800 bg-gray-900/50 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Key className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{k.name}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {k.key_prefix}••••••••••••••••••••••••••••••••
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-500">
                    {k.last_used_at
                      ? `${l.lastUsed}: ${new Date(k.last_used_at).toLocaleDateString(localeTag)}`
                      : l.never}
                  </p>
                  <p className="text-xs text-gray-600">
                    {l.created}: {new Date(k.created_at).toLocaleDateString(localeTag)}
                  </p>
                </div>
                <button
                  onClick={() => revoke(k.id)}
                  disabled={!!revoking}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  aria-label={l.revoke}
                >
                  {revoking === k.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Docs hint */}
      <p className="text-xs text-gray-600">{l.docsHint}</p>
    </div>
  );
}
