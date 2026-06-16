"use client";

import { useState } from "react";
import { Send, CheckCircle, Loader2, FlaskConical } from "lucide-react";

interface InvitedUser {
  email: string;
  name: string;
  organization: string;
  trialEnd: string;
}

export default function AdminPilotInviteForm({ locale }: { locale: string }) {
  const [email, setEmail]         = useState("");
  const [name, setName]           = useState("");
  const [organization, setOrg]    = useState("");
  const [emailLocale, setELocale] = useState<"en" | "fr">("en");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sent, setSent]           = useState<InvitedUser[]>([]);

  const inputClass = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors text-sm";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name || !organization) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, organization, locale: emailLocale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setSent((prev) => [...prev, { email, name, organization, trialEnd: data.trialEnd }]);
      setEmail("");
      setName("");
      setOrg("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-red-400" />
        <h2 className="text-base font-semibold text-white">Pilot Invites</h2>
        <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5">Pro · 35 jours</span>
      </div>

      <form onSubmit={handleSend} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input required className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Celestine Amoah" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input required type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder="celestine@who.int" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Organization</label>
            <input required className={inputClass} value={organization} onChange={e => setOrg(e.target.value)} placeholder="WHO AFRO" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email language</label>
            <select className={inputClass} value={emailLocale} onChange={e => setELocale(e.target.value as "en" | "fr")}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
            : <><Send className="w-4 h-4" />Send pilot invite</>}
        </button>
      </form>

      {sent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Invitations envoyées</p>
          {sent.map((u) => (
            <div key={u.email} className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{u.name} — {u.organization}</p>
                <p className="text-xs text-gray-500 truncate">{u.email} · Pro until {u.trialEnd.slice(0, 10)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
