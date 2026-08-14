import { useEffect, useState } from "react";

const DAILY_LIMIT = 70;

function App() {
  const [spentToday, setSpentToday] = useState(0);
  const [debt, setDebt] = useState(0);
  const [savings, setSavings] = useState(0);

  // Load saved data
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("budgetData"));

    if (data) {
      setSpentToday(data.spentToday || 0);
      setDebt(data.debt || 0);
      setSavings(data.savings || 0);
    }
  }, []);

  // Save data whenever values change
  useEffect(() => {
    localStorage.setItem(
      "budgetData",
      JSON.stringify({ spentToday, debt, savings })
    );
  }, [spentToday, debt, savings]);

  const availableToday = Math.max(0, DAILY_LIMIT - spentToday);

  const addExpense = () => {
    const value = prompt("Enter expense amount");

    if (!value) return;

    const amount = Number(value);

    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }

    const newSpent = spentToday + amount;
    setSpentToday(newSpent);

    // Increase debt only if limit exceeded
    if (newSpent > DAILY_LIMIT) {
      setDebt(newSpent - DAILY_LIMIT);
    }
  };

  const addSavings = () => {
    const value = prompt("Enter amount to save");

    if (!value) return;

    const amount = Number(value);

    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }

    if (amount > availableToday) {
      alert("You cannot save more than today's remaining amount");
      return;
    }

    setSavings(savings + amount);
    setSpentToday(spentToday + amount);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center p-4 pb-20 md:pb-4">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl">

        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
          Daily Budget Tracker
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Today Card */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-semibold mb-2">Today</h2>

            <p className="text-gray-500 text-sm">Available Today</p>
            <p className="text-4xl font-bold text-green-600">
              ₹{availableToday}
            </p>

            <div className="mt-4">
              <p className="text-gray-500 text-sm">Spent Today</p>
              <p className="text-2xl font-semibold">₹{spentToday}</p>
            </div>

            <div className="mt-4">
              <p className="text-gray-500 text-sm">Debt Remaining</p>
              <p className="text-2xl font-semibold text-red-600">₹{debt}</p>
            </div>

            <button
              onClick={addExpense}
              className="mt-5 w-full rounded-xl bg-black text-white py-3 text-lg font-medium active:scale-95 transition"
            >
              Add Expense
            </button>
          </div>

          {/* Savings Card */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-semibold mb-2">Savings</h2>

            <p className="text-gray-500 text-sm">Saved for Future</p>
            <p className="text-4xl font-bold text-blue-600">₹{savings}</p>

            <button
              onClick={addSavings}
              className="mt-5 w-full rounded-xl border border-black py-3 text-lg font-medium active:scale-95 transition"
            >
              Add to Savings
            </button>
          </div>

        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow p-5 mt-4">
          <h2 className="text-lg font-semibold mb-3">Calendar</h2>

          <div className="grid grid-cols-7 gap-2 text-center text-sm">
            {Array.from({ length: 31 }, (_, i) => (
              <div
                key={i}
                className={`rounded-lg py-3 font-medium ${
                  debt > 0
                    ? "bg-red-200 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>

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
  );
}

export default App;