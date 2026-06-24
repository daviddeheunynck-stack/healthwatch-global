"use client";

import { useState } from "react";
import { Trash2, X, Loader2 } from "lucide-react";

const LABELS: Record<string, {
  trigger: string;
  title: string;
  body: string;
  placeholder: string;
  confirm: string;
  cancel: string;
  deleting: string;
  errorGeneric: string;
}> = {
  en: {
    trigger: "Delete my account",
    title: "Delete account",
    body: "This action is permanent and cannot be undone. Your profile, alert subscriptions, and all associated data will be erased. Active subscriptions will be cancelled immediately.",
    placeholder: 'Type "DELETE" to confirm',
    confirm: "Permanently delete account",
    cancel: "Cancel",
    deleting: "Deleting…",
    errorGeneric: "Deletion failed. Please contact contact@healthwatch-global.com.",
  },
  fr: {
    trigger: "Supprimer mon compte",
    title: "Supprimer le compte",
    body: "Cette action est permanente et irréversible. Votre profil, vos abonnements aux alertes et toutes vos données associées seront effacés. Les abonnements actifs seront annulés immédiatement.",
    placeholder: 'Tapez "SUPPRIMER" pour confirmer',
    confirm: "Supprimer définitivement le compte",
    cancel: "Annuler",
    deleting: "Suppression…",
    errorGeneric: "Échec de la suppression. Contactez contact@healthwatch-global.com.",
  },
  es: {
    trigger: "Eliminar mi cuenta",
    title: "Eliminar cuenta",
    body: "Esta acción es permanente e irreversible. Su perfil, suscripciones a alertas y todos los datos asociados serán eliminados. Las suscripciones activas se cancelarán de inmediato.",
    placeholder: 'Escriba "ELIMINAR" para confirmar',
    confirm: "Eliminar cuenta permanentemente",
    cancel: "Cancelar",
    deleting: "Eliminando…",
    errorGeneric: "Error al eliminar. Contacte contact@healthwatch-global.com.",
  },
  ar: {
    trigger: "حذف حسابي",
    title: "حذف الحساب",
    body: "هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم حذف ملفك الشخصي واشتراكاتك في التنبيهات وجميع بياناتك المرتبطة. ستُلغى الاشتراكات النشطة فوراً.",
    placeholder: 'اكتب "حذف" للتأكيد',
    confirm: "حذف الحساب نهائياً",
    cancel: "إلغاء",
    deleting: "جارٍ الحذف…",
    errorGeneric: "فشل الحذف. تواصل مع contact@healthwatch-global.com.",
  },
  id: {
    trigger: "Hapus akun saya",
    title: "Hapus akun",
    body: "Tindakan ini permanen dan tidak dapat dibatalkan. Profil, langganan peringatan, dan semua data terkait Anda akan dihapus. Langganan aktif akan dibatalkan segera.",
    placeholder: 'Ketik "HAPUS" untuk konfirmasi',
    confirm: "Hapus akun secara permanen",
    cancel: "Batal",
    deleting: "Menghapus…",
    errorGeneric: "Penghapusan gagal. Hubungi contact@healthwatch-global.com.",
  },
};

const CONFIRM_WORDS: Record<string, string> = {
  en: "DELETE", fr: "SUPPRIMER", es: "ELIMINAR", ar: "حذف", id: "HAPUS",
};

export default function DeleteAccountButton({ locale }: { locale: string }) {
  const l = LABELS[locale] ?? LABELS.en;
  const confirmWord = CONFIRM_WORDS[locale] ?? "DELETE";
  const isRtl = locale === "ar";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (input.trim() !== confirmWord) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      window.location.assign("/en");
    } catch {
      setError(l.errorGeneric);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        {l.trigger}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative bg-gray-900 border border-red-900/40 rounded-2xl p-8 w-full max-w-md shadow-2xl"
            dir={isRtl ? "rtl" : "ltr"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !loading && setOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center mb-5">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>

            <h2 className="text-xl font-bold text-white mb-3">{l.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">{l.body}</p>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={l.placeholder}
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 mb-4 disabled:opacity-50"
            />

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <button
              onClick={handleDelete}
              disabled={input.trim() !== confirmWord || loading}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {l.deleting}
                </>
              ) : l.confirm}
            </button>

            <button
              onClick={() => !loading && setOpen(false)}
              disabled={loading}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              {l.cancel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
