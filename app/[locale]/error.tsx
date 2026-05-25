"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HealthWatch] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="text-gray-400 mt-2 max-w-md">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="block text-xs text-gray-600 mt-1">Error ID: {error.digest}</span>
          )}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <a
          href="/"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
