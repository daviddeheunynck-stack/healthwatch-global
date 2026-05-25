export default function ReportsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 bg-gray-800 rounded w-64" />
        <div className="h-4 bg-gray-800 rounded w-96" />
      </div>

      {/* Report cards grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-5 bg-gray-800 rounded w-24" />
                <div className="h-3 bg-gray-800 rounded w-36" />
              </div>
              <div className="h-9 bg-gray-800 rounded-lg w-28" />
            </div>
            <div className="space-y-2.5">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-3 bg-gray-800 rounded w-28" />
                  <div className="h-3 bg-gray-800 rounded w-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
