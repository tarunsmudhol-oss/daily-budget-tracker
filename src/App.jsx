function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center p-4 pb-20 md:pb-4">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl">

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
          Daily Budget Tracker
        </h1>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Today Card */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-semibold mb-2">Today</h2>

            <p className="text-gray-500 text-sm">Available Today</p>
            <p className="text-4xl font-bold text-green-600">₹70</p>

            <div className="mt-4">
              <p className="text-gray-500 text-sm">Debt Remaining</p>
              <p className="text-2xl font-semibold text-red-600">₹0</p>
            </div>

            <button className="mt-5 w-full rounded-xl bg-black text-white py-3 text-lg font-medium active:scale-95 transition">
              Add Expense
            </button>
          </div>

          {/* Savings Card */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-semibold mb-2">Savings</h2>

            <p className="text-gray-500 text-sm">Saved for Future</p>
            <p className="text-4xl font-bold text-blue-600">₹0</p>

            <button className="mt-5 w-full rounded-xl border border-black py-3 text-lg font-medium active:scale-95 transition">
              Add to Savings
            </button>
          </div>

        </div>

        {/* Calendar Card */}
        <div className="bg-white rounded-2xl shadow p-5 mt-4">
          <h2 className="text-lg font-semibold mb-3">Calendar</h2>

          <div className="grid grid-cols-7 gap-2 text-center text-sm">
            {Array.from({ length: 31 }, (_, i) => (
              <div
                key={i}
                className={`rounded-lg py-3 font-medium ${
                  i === 0 || i === 1
                    ? "bg-red-200 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-100 border"></span>
              Normal
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-200 border"></span>
              Debt / Overspend
            </div>
          </div>
        </div>

      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden shadow-sm">
        <div className="grid grid-cols-4 text-center py-2 text-sm">
          <button className="font-medium">Home</button>
          <button>Save</button>
          <button>Calendar</button>
          <button>History</button>
        </div>
      </nav>
    </div>
  )
}

export default App