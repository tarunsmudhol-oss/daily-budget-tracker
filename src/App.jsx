import { useEffect, useState } from "react";

const DAILY_LIMIT = 70;

function App() {
  const todayString = "2026-08-15";

const [spentToday, setSpentToday] = useState(0);
const [debt, setDebt] = useState(0);
const [savings, setSavings] = useState(0);
const [lastDate, setLastDate] = useState(todayString);
const [goalName, setGoalName] = useState("Headphones");
const [goalTarget, setGoalTarget] = useState(2000);

  // Load saved data
 useEffect(() => {
  const data = JSON.parse(localStorage.getItem("budgetData"));

  if (!data) return;

  let currentDebt = data.debt || 0;

  // Check if a new day has started
  if (data.lastDate !== todayString) {
    // Daily limit reduces debt automatically
    currentDebt = Math.max(0, currentDebt - DAILY_LIMIT);

    setSpentToday(0);
    setDebt(currentDebt);
    setSavings(data.savings || 0);
    setLastDate(todayString);

    localStorage.setItem(
      "budgetData",
      JSON.stringify({
        spentToday: 0,
        debt: currentDebt,
        savings: data.savings || 0,
        lastDate: todayString,
      })
    );
  } else {
    setSpentToday(data.spentToday || 0);
    setDebt(currentDebt);
    setSavings(data.savings || 0);
    setLastDate(data.lastDate || todayString);
  }
}, []);

  // Save data whenever values change
  useEffect(() => {
    localStorage.setItem(
      "budgetData",
      JSON.stringify({ spentToday, debt, savings, lastDate })
    );
  }, [spentToday, debt, savings]);

  const availableToday = debt > 0 ? 0 : Math.max(0, DAILY_LIMIT - spentToday);
  const progress = Math.min((savings / goalTarget) * 100, 100);

 const addExpense = () => {
  const value = prompt("Enter expense amount");

  if (!value) return;

  const amount = Number(value);

  if (isNaN(amount) || amount <= 0) {
    alert("Enter a valid amount");
    return;
  }

  // If debt exists, any new spending increases debt
  if (debt > 0) {
    setDebt(debt + amount);
    return;
  }

  const newSpent = spentToday + amount;
  setSpentToday(newSpent);

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
  <h2 className="text-lg font-semibold mb-2">Savings Goal</h2>

  <p className="text-gray-500 text-sm">Goal</p>
  <p className="text-xl font-semibold">{goalName}</p>

  <div className="mt-3">
    <div className="flex justify-between text-sm mb-1">
      <span>Saved</span>
      <span>₹{savings} / ₹{goalTarget}</span>
    </div>

    <div className="w-full bg-gray-200 rounded-full h-3">
      <div
        className="bg-blue-600 h-3 rounded-full transition-all"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  </div>

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