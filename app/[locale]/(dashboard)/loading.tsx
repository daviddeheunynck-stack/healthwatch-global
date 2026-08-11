export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="h-3 bg-gray-800 rounded w-24" />
            <div className="h-8 bg-gray-800 rounded w-12" />
          </div>
        ))}
      </div>

      {/* Map placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-700">
          <div className="w-12 h-12 rounded-full bg-gray-800" />
          <div className="h-3 bg-gray-800 rounded w-32" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="bg-gray-900 px-4 py-3 flex gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-800 rounded w-16" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-t border-gray-800 px-4 py-3 flex gap-6">
            <div className="h-3 bg-gray-800/60 rounded w-32" />
            <div className="h-3 bg-gray-800/60 rounded w-20" />
            <div className="h-3 bg-gray-800/60 rounded w-12" />
            <div className="h-3 bg-gray-800/60 rounded w-10" />
            <div className="h-5 bg-gray-800/60 rounded-full w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
