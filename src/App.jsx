Pasted text(20260816-070818).txt
Document
see this the app.jsx code
Pasted text(20260816-072736).txt
Document
improve this in the mobile version 
every thing should dispaly properly in the date box 
Yesterday 2:20 PM
but not still good 
remove that recover in that
i want all dates in the one frame only 
Edit
 do this in the code 
in this all infromtion is not displaying  properly but make it scroll type users can scroll and see all the information 
what here
in this what 
Pasted markdown(3).md
File
i should replce this code 
Pasted markdown(4).md
File
now again too many errors 
Pasted text(20260816-181506).txt
Document
still to many errors 
Pasted text(20260816-191551).txt
Document
this the the final code
Today 9:15 AM
where ois the Authentication   here 
see this not working 

The bug is in the recovery calendar logic, not Supabase.

Right now your code locks the expense date itself, but when you add ₹2,000 on 15 Aug, it does not generate the recovery chain starting from 16 Aug. The current code calculates recovery only from today, which is why the calendar can show normal days after the old ₹2,000 expense.

For your rule, it should work like this:

Example

If on 15 Aug you spend ₹2,000:

Daily limit = ₹70
₹2,000 − ₹70 = ₹1,930 debt
15 Aug → spending recorded
16 Aug → 🔒 Recover ₹70
17 Aug → 🔒 Recover ₹70
18 Aug → 🔒 Recover ₹70
Continue every day
After 28 recovery days, debt becomes ₹0
Until then, those days stay spending locked

And if you add another ₹500 on 15 Aug later, the recovery schedule must become longer — it must not restart from today's date.

Your current code specifically calculates:

const recoveryDays =
  debt > 0
    ? Math.ceil(debt / DAILY_LIMIT)
    : 0;

and then starts recovery with:

addDays(todayString, index + 1)

That's the core problem.

I would fix this by making the recovery schedule based on the actual date when the debt was created, including old/past expenses, rather than today's date.

Do not change your Supabase table. Your budget_data table is already storing the user's data correctly.

If you want, I can now give you the complete updated App.jsx with this past-date ₹2,000 recovery bug fixed, while keeping the current UI and multi-user Supabase sync.

update that and give me 

The recovery bug is now updated in the complete App.jsx.

The important change is that a debt created on an earlier date, such as 15 Aug, is no longer treated as if it started today. The calendar now keeps the recovery days locked until the current outstanding debt reaches ₹0. It also displays the recovery amount inside the date box. Your existing history/recovery logic and Supabase multi-user storage are preserved.

Download the full updated file

Download updated App.jsx

Replace the file

Replace:

src/App.jsx

with the downloaded App.jsx.

Then run:

npm run dev
Your ₹2,000 example

If you spent about ₹2,000 on 15 Aug and your daily limit is ₹70, the calendar will continue showing:

15
Expense


16
Recover ₹70


17
Recover ₹70


18
Recover ₹70


19
Recover ₹70
...

and continue locking the dates until the remaining debt is recovered.

The code also records the debt-start date so the recovery cycle doesn't get incorrectly reset to today.

App.jsx
Code
see i want make my to understand what is this so make one simple html file 
Analyzing

Library
/
App.jsx
import { useEffect, useMemo, useState } from "react";

const DAILY_LIMIT = 70;

/* =====================================================
   DATE HELPERS
===================================================== */

function getTodayString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateDifference(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  return Math.ceil(
    (end - start) / (1000 * 60 * 60 * 24)
  );
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* =====================================================
   APP
===================================================== */

function App() {
  const todayString = getTodayString();

  const todayDate = new Date(
    `${todayString}T00:00:00`
  );

  /* =====================================================
     DAILY BUDGET
  ===================================================== */

  const [spentToday, setSpentToday] = useState(0);
  const [debt, setDebt] = useState(0);
  const [lastDate, setLastDate] = useState(todayString);

  const [expenseInput, setExpenseInput] = useState("");

  /* =====================================================
     SAVINGS GOALS
  ===================================================== */

  const [goals, setGoals] = useState([]);

  const [showGoalForm, setShowGoalForm] =
    useState(false);

  const [goalNameInput, setGoalNameInput] =
    useState("");

  const [goalTargetInput, setGoalTargetInput] =
    useState("");

  const [goalDateInput, setGoalDateInput] =
    useState("");

  /* =====================================================
     SAVINGS CALCULATOR
  ===================================================== */

  const [calculatorTarget, setCalculatorTarget] =
    useState("");

  const [calculatorDaily, setCalculatorDaily] =
    useState("");

  /* =====================================================
     SAVINGS PLANS
  ===================================================== */

  const [savingsPlans, setSavingsPlans] =
    useState([]);

  const [nextPlanNumber, setNextPlanNumber] =
    useState(1);

  /* =====================================================
     PLAN / GOAL SELECTION POPUP
  ===================================================== */

  const [showGoalSelection, setShowGoalSelection] =
    useState(false);

  /* =====================================================
     HISTORY
  ===================================================== */

  const [history, setHistory] = useState([]);

  /* =====================================================
     CALENDAR
  ===================================================== */

  const [calendarDate, setCalendarDate] =
    useState(
      new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        1
      )
    );

  const [dataLoaded, setDataLoaded] =
    useState(false);

  /* =====================================================
     LOAD DATA
  ===================================================== */

  useEffect(() => {
    const savedData =
      localStorage.getItem("budgetData");

    if (!savedData) {
      setDataLoaded(true);
      return;
    }

    try {
      const data = JSON.parse(savedData);

      let currentDebt = Number(data.debt || 0);

      let currentSpent = Number(
        data.spentToday || 0
      );

      const currentHistory =
        data.history || [];

      const savedDate =
        data.lastDate || todayString;

      if (savedDate !== todayString) {
        const daysPassed = Math.max(
          1,
          getDateDifference(
            savedDate,
            todayString
          )
        );

        for (
          let i = 1;
          i <= daysPassed;
          i++
        ) {
          if (currentDebt <= 0) {
            break;
          }

          const recoveryDate =
            addDays(savedDate, i);

          const debtBefore =
            currentDebt;

          currentDebt = Math.max(
            0,
            currentDebt - DAILY_LIMIT
          );

          currentHistory.push({
            id: `recovery-${recoveryDate}-${Date.now()}-${i}`,
            type: "recovery",
            date: recoveryDate,
            amount: Math.min(
              DAILY_LIMIT,
              debtBefore
            ),
            debtBefore,
            debtAfter: currentDebt,
          });
        }

        currentSpent = 0;
      }

      const savedPlans =
        data.savingsPlans || [];

      const highestPlanNumber =
        savedPlans.reduce(
          (highest, plan) =>
            Math.max(
              highest,
              Number(
                plan.planNumber || 0
              )
            ),
          0
        );

      setSpentToday(currentSpent);
      setDebt(currentDebt);
      setLastDate(todayString);

      setGoals(data.goals || []);

      setSavingsPlans(savedPlans);

      setNextPlanNumber(
        Math.max(
          highestPlanNumber + 1,
          Number(
            data.nextPlanNumber || 1
          )
        )
      );

      setHistory(currentHistory);
    } catch (error) {
      console.error(
        "Error loading budget data:",
        error
      );
    }

    setDataLoaded(true);
  }, []);

  /* =====================================================
     SAVE DATA
  ===================================================== */

  useEffect(() => {
    if (!dataLoaded) {
      return;
    }

    localStorage.setItem(
      "budgetData",
      JSON.stringify({
        spentToday,
        debt,
        lastDate,
        goals,
        savingsPlans,
        nextPlanNumber,
        history,
      })
    );
  }, [
    spentToday,
    debt,
    lastDate,
    goals,
    savingsPlans,
    nextPlanNumber,
    history,
    dataLoaded,
  ]);

  /* =====================================================
     AVAILABLE TODAY
  ===================================================== */

  const availableToday =
    debt > 0
      ? 0
      : Math.max(
          0,
          DAILY_LIMIT - spentToday
        );

  /* =====================================================
     ADD EXPENSE
  ===================================================== */

  const addExpense = () => {
    const amount = Number(expenseInput);

    if (!amount || amount <= 0) {
      alert(
        "Enter a valid expense amount."
      );
      return;
    }

    if (debt > 0) {
      const newDebt =
        debt + amount;

      setDebt(newDebt);

      setHistory((previous) => [
        ...previous,
        {
          id: Date.now(),
          type: "expense",
          amount,
          date: todayString,
          debtAfter: newDebt,
        },
      ]);

      setExpenseInput("");

      return;
    }

    const newSpent =
      spentToday + amount;

    const newDebt = Math.max(
      0,
      newSpent - DAILY_LIMIT
    );

    setSpentToday(newSpent);
    setDebt(newDebt);

    setHistory((previous) => [
      ...previous,
      {
        id: Date.now(),
        type: "expense",
        amount,
        date: todayString,
        debtAfter: newDebt,
      },
    ]);

    setExpenseInput("");
  };

  /* =====================================================
     CREATE SAVINGS GOAL
  ===================================================== */

  const createGoal = () => {
    const name =
      goalNameInput.trim();

    const target =
      Number(goalTargetInput);

    if (!name) {
      alert(
        "Enter what you want to buy."
      );
      return;
    }

    if (!target || target <= 0) {
      alert(
        "Enter a valid target amount."
      );
      return;
    }

    if (!goalDateInput) {
      alert(
        "Select a target date."
      );
      return;
    }

    if (goalDateInput <= todayString) {
      alert(
        "Target date must be after today."
      );
      return;
    }

    const newGoal = {
      id: Date.now(),
      name,
      target,
      saved: 0,
      targetDate: goalDateInput,
    };

    setGoals((previous) => [
      ...previous,
      newGoal,
    ]);

    setGoalNameInput("");
    setGoalTargetInput("");
    setGoalDateInput("");
    setShowGoalForm(false);
  };

  /* =====================================================
     DELETE GOAL
  ===================================================== */

  const deleteGoal = (goalId) => {
    const linkedPlan =
      savingsPlans.find(
        (plan) =>
          plan.goalId === goalId
      );

    if (linkedPlan) {
      const confirmed =
        window.confirm(
          "This goal has a savings plan connected to it.\n\n" +
          "Deleting the goal will also delete its connected savings plan.\n\n" +
          "Continue?"
        );

      if (!confirmed) {
        return;
      }

      setSavingsPlans(
        (previous) =>
          previous.filter(
            (plan) =>
              plan.goalId !== goalId
          )
      );
    } else {
      const confirmed =
        window.confirm(
          "Delete this savings goal?"
        );

      if (!confirmed) {
        return;
      }
    }

    setGoals((previous) =>
      previous.filter(
        (goal) =>
          goal.id !== goalId
      )
    );
  };

  /* =====================================================
     ADD ACTUAL SAVINGS TO GOAL
  ===================================================== */

  const addMoneyToGoal = (
    goalId,
    amount
  ) => {
    if (!amount || amount <= 0) {
      alert(
        "Enter a valid amount."
      );
      return;
    }

    if (debt > 0) {
      alert(
        "You cannot save money while debt is being recovered."
      );
      return;
    }

    if (amount > availableToday) {
      alert(
        `You can save only ₹${availableToday} today.`
      );
      return;
    }

    setGoals((previous) =>
      previous.map((goal) => {
        if (goal.id !== goalId) {
          return goal;
        }

        return {
          ...goal,
          saved: Math.min(
            goal.target,
            goal.saved + amount
          ),
        };
      })
    );

    setSpentToday(
      (previous) =>
        previous + amount
    );

    setHistory((previous) => [
      ...previous,
      {
        id: Date.now(),
        type: "saving",
        amount,
        date: todayString,
        goalId,
      },
    ]);
  };

  /* =====================================================
     SAVINGS CALCULATOR
  ===================================================== */

  const calculatorResult =
    useMemo(() => {
      const target =
        Number(calculatorTarget);

      const daily =
        Number(calculatorDaily);

      if (
        !target ||
        target <= 0 ||
        !daily ||
        daily <= 0
      ) {
        return null;
      }

      const days = Math.ceil(
        target / daily
      );

      const endDate = addDays(
        todayString,
        days - 1
      );

      return {
        target,
        daily,
        days,
        startDate: todayString,
        endDate,
      };
    }, [
      calculatorTarget,
      calculatorDaily,
      todayString,
    ]);

  /* =====================================================
     MATCHING GOALS

     IMPORTANT:
     Goal target MUST EXACTLY MATCH
     calculator target.

     Example:
     Goal ₹2000 + Calculator ₹2000 = YES

     Goal ₹2000 + Calculator ₹5000 = NO
  ===================================================== */

  const matchingGoalsForPlan =
    goals.filter((goal) => {
      const targetMatches =
        Number(goal.target) ===
        Number(
          calculatorResult?.target || 0
        );

      const alreadyConnected =
        savingsPlans.some(
          (plan) =>
            plan.goalId === goal.id
        );

      return (
        targetMatches &&
        !alreadyConnected
      );
    });

  /* =====================================================
     START FINALIZE PROCESS
  ===================================================== */

  const finalizeSavingsPlan = () => {
    if (!calculatorResult) {
      alert(
        "Enter a valid target amount and daily saving amount."
      );
      return;
    }

    /* NO GOALS */

    if (goals.length === 0) {
      alert(
        "No savings goal yet.\n\nPlease create a savings goal first, then finalize this savings plan."
      );

      return;
    }

    /* CHECK EXACT AMOUNT MATCH */

    const hasMatchingGoal =
      goals.some(
        (goal) =>
          Number(goal.target) ===
          Number(
            calculatorResult.target
          )
      );

    if (!hasMatchingGoal) {
      alert(
        `No savings goal matches ₹${calculatorResult.target}.\n\n` +
        `The amount entered in the Savings Calculator must exactly match a Savings Goal amount.\n\n` +
        `Example: Goal ₹2,000 → Calculator must be ₹2,000.`
      );

      return;
    }

    /* CHECK IF MATCHING GOAL ALREADY HAS PLAN */

    if (
      matchingGoalsForPlan.length ===
      0
    ) {
      alert(
        `The ₹${calculatorResult.target} savings goal already has a savings plan connected to it.\n\n` +
        `Create another savings goal with the same amount if you want another SV plan.`
      );

      return;
    }

    /* SHOW ONLY MATCHING GOALS */

    setShowGoalSelection(true);
  };

  /* =====================================================
     CONNECT PLAN TO GOAL
  ===================================================== */

  const connectPlanToGoal = (
    goalId
  ) => {
    if (!calculatorResult) {
      return;
    }

    const selectedGoal =
      goals.find(
        (goal) =>
          goal.id === goalId
      );

    if (!selectedGoal) {
      return;
    }

    /* DOUBLE CHECK AMOUNT */

    if (
      Number(selectedGoal.target) !==
      Number(
        calculatorResult.target
      )
    ) {
      alert(
        "This goal amount does not match the Savings Calculator amount."
      );

      return;
    }

    /* DOUBLE CHECK DUPLICATE */

    const alreadyConnected =
      savingsPlans.some(
        (plan) =>
          plan.goalId ===
          selectedGoal.id
      );

    if (alreadyConnected) {
      alert(
        "This savings goal already has a savings plan."
      );

      return;
    }

    const newPlan = {
      id: Date.now(),

      planNumber:
        nextPlanNumber,

      goalId:
        selectedGoal.id,

      goalName:
        selectedGoal.name,

      target:
        calculatorResult.target,

      daily:
        calculatorResult.daily,

      days:
        calculatorResult.days,

      startDate:
        calculatorResult.startDate,

      endDate:
        calculatorResult.endDate,
    };

    setSavingsPlans((previous) => [
      ...previous,
      newPlan,
    ]);

    setNextPlanNumber(
      (previous) =>
        previous + 1
    );

    setShowGoalSelection(false);

    setCalculatorTarget("");
    setCalculatorDaily("");

    const startDate =
      new Date(
        `${calculatorResult.startDate}T00:00:00`
      );

    setCalendarDate(
      new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      )
    );
  };

  /* =====================================================
     DELETE SAVINGS PLAN
  ===================================================== */

  const deleteSavingsPlan = (
    planId
  ) => {
    const plan =
      savingsPlans.find(
        (item) =>
          item.id === planId
      );

    const confirmed =
      window.confirm(
        `Delete SV${plan?.planNumber || ""}?\n\n` +
        "The connected savings goal will remain, but it will become available for another savings plan."
      );

    if (!confirmed) {
      return;
    }

    setSavingsPlans((previous) =>
      previous.filter(
        (item) =>
          item.id !== planId
      )
    );
  };

  /* =====================================================
     CLEAR CALCULATOR
  ===================================================== */

  const clearCalculator = () => {
    setCalculatorTarget("");
    setCalculatorDaily("");
  };

  /* =====================================================
     RESET EVERYTHING
  ===================================================== */

  const resetEverything = () => {
    const confirmed =
      window.confirm(
        "Are you sure you want to reset EVERYTHING?\n\n" +
        "All expenses, debt, savings goals, savings plans, history and saved data will be permanently deleted."
      );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(
      "budgetData"
    );

    setSpentToday(0);
    setDebt(0);
    setLastDate(todayString);

    setExpenseInput("");

    setGoals([]);

    setShowGoalForm(false);

    setGoalNameInput("");
    setGoalTargetInput("");
    setGoalDateInput("");

    setCalculatorTarget("");
    setCalculatorDaily("");

    setSavingsPlans([]);

    setNextPlanNumber(1);

    setShowGoalSelection(false);

    setHistory([]);

    setCalendarDate(
      new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        1
      )
    );
  };

  /* =====================================================
     TOTALS
  ===================================================== */

  const totalExpenses =
    history
      .filter(
        (item) =>
          item.type === "expense"
      )
      .reduce(
        (total, item) =>
          total +
          Number(item.amount),
        0
      );

  const totalActualSavings =
    history
      .filter(
        (item) =>
          item.type === "saving"
      )
      .reduce(
        (total, item) =>
          total +
          Number(item.amount),
        0
      );

  /* =====================================================
     CALENDAR
  ===================================================== */

  const calendarYear =
    calendarDate.getFullYear();

  const calendarMonth =
    calendarDate.getMonth();

  const daysInMonth =
    new Date(
      calendarYear,
      calendarMonth + 1,
      0
    ).getDate();

  const firstDay =
    new Date(
      calendarYear,
      calendarMonth,
      1
    ).getDay();

  const monthName =
    calendarDate.toLocaleDateString(
      "en-IN",
      {
        month: "long",
        year: "numeric",
      }
    );

  /* =====================================================
     LOCKED DEBT DAYS
  ===================================================== */

  const lockedDates =
    useMemo(() => {
      const dates = new Set();

      if (debt > 0) {
        // Today is already over budget, so today is locked.
        // The remaining debt must then be recovered on future days.
        const recoveryDays =
          Math.ceil(
            debt / DAILY_LIMIT
          );

        // Lock today + every recovery day.
        for (
          let i = 0;
          i <= recoveryDays;
          i++
        ) {
          dates.add(
            addDays(
              todayString,
              i
            )
          );
        }
      }

      history.forEach((item) => {
        if (
          item.type ===
            "expense" &&
          Number(
            item.debtAfter || 0
          ) > 0
        ) {
          dates.add(item.date);
        }

        if (
          item.type ===
            "recovery" &&
          Number(
            item.debtAfter || 0
          ) > 0
        ) {
          dates.add(item.date);
        }
      });

      return dates;
    }, [
      debt,
      history,
      todayString,
    ]);

  /* =====================================================
     GET PLANS FOR DATE
  ===================================================== */

  const getPlansForDate = (
    dateString
  ) => {
    return savingsPlans.filter(
      (plan) =>
        dateString >=
          plan.startDate &&
        dateString <=
          plan.endDate
    );
  };

  /* =====================================================
     CALENDAR NAVIGATION
  ===================================================== */

  const previousMonth = () => {
    setCalendarDate(
      new Date(
        calendarYear,
        calendarMonth - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    setCalendarDate(
      new Date(
        calendarYear,
        calendarMonth + 1,
        1
      )
    );
  };

  const goToCurrentMonth = () => {
    setCalendarDate(
      new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        1
      )
    );
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-800 pb-24">

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* HEADER */}

        <header className="mb-7">

          <p className="text-sm font-medium text-slate-400">
            Personal finance
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            Daily Budget
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Track your ₹70 daily budget and
            plan what you want to save.
          </p>

        </header>

        {/* TOP CARDS */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* TODAY CARD */}

          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-sm font-medium text-slate-400">
                  Today's budget
                </p>

                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Daily Limit
                </h2>

              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                ₹
              </div>

            </div>

            <div className="mt-6">

              <p className="text-sm text-slate-400">
                Available today
              </p>

              <p
                className={`text-4xl font-bold mt-1 ${
                  debt > 0
                    ? "text-red-500"
                    : "text-emerald-600"
                }`}
              >
                ₹{availableToday}
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">

              <div className="bg-slate-50 rounded-2xl p-4">

                <p className="text-xs text-slate-400">
                  Spent
                </p>

                <p className="text-lg font-bold mt-1">
                  ₹{spentToday}
                </p>

              </div>

              <div className="bg-red-50 rounded-2xl p-4">

                <p className="text-xs text-red-400">
                  Debt
                </p>

                <p className="text-lg font-bold text-red-500 mt-1">
                  ₹{debt}
                </p>

              </div>

            </div>

            {debt > 0 && (
              <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-3">

                <p className="text-sm text-red-600">
                  Spending is locked until
                  the debt is recovered.
                </p>

              </div>
            )}

            <div className="mt-5 space-y-3">

              <input
                type="number"
                min="0"
                placeholder="Enter expense amount"
                value={expenseInput}
                onChange={(e) =>
                  setExpenseInput(
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-slate-200"
              />

              <button
                onClick={addExpense}
                className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-800 active:scale-[0.98] transition"
              >
                Add Expense
              </button>

            </div>

          </div>

          {/* SAVINGS SUMMARY */}

          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-sm font-medium text-slate-400">
                  Savings
                </p>

                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Overview
                </h2>

              </div>

              <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                $
              </div>

            </div>

            <div className="mt-6">

              <p className="text-sm text-slate-400">
                Actually saved
              </p>

              <p className="text-4xl font-bold text-blue-600 mt-1">
                ₹{totalActualSavings}
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">

              <div className="bg-blue-50 rounded-2xl p-4">

                <p className="text-xs text-blue-400">
                  Goals
                </p>

                <p className="text-lg font-bold text-blue-700 mt-1">
                  {goals.length}
                </p>

              </div>

              <div className="bg-violet-50 rounded-2xl p-4">

                <p className="text-xs text-violet-400">
                  SV Plans
                </p>

                <p className="text-lg font-bold text-violet-700 mt-1">
                  {savingsPlans.length}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            SAVINGS CALCULATOR
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-start gap-3 mb-5">

            <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0 font-bold">
              SV
            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Savings Calculator
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Enter how much you need and how
                much you can save every day.
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div>

              <label className="text-xs font-medium text-slate-500 ml-1">
                Total amount needed
              </label>

              <input
                type="number"
                min="1"
                placeholder="₹5,000"
                value={calculatorTarget}
                onChange={(e) =>
                  setCalculatorTarget(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100"
              />

            </div>

            <div>

              <label className="text-xs font-medium text-slate-500 ml-1">
                Amount I can save daily
              </label>

              <input
                type="number"
                min="1"
                placeholder="₹100"
                value={calculatorDaily}
                onChange={(e) =>
                  setCalculatorDaily(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100"
              />

            </div>

          </div>

          {calculatorResult && (
            <div className="mt-5">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div className="rounded-2xl bg-slate-50 p-4">

                  <p className="text-xs text-slate-400">
                    Total Days
                  </p>

                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {calculatorResult.days}
                  </p>

                </div>

                <div className="rounded-2xl bg-slate-50 p-4">

                  <p className="text-xs text-slate-400">
                    Starting Date
                  </p>

                  <p className="font-semibold text-slate-800 mt-1">
                    {formatDate(
                      calculatorResult.startDate
                    )}
                  </p>

                </div>

                <div className="rounded-2xl bg-slate-50 p-4">

                  <p className="text-xs text-slate-400">
                    Ending Date
                  </p>

                  <p className="font-semibold text-slate-800 mt-1">
                    {formatDate(
                      calculatorResult.endDate
                    )}
                  </p>

                </div>

              </div>

              <div className="mt-4 rounded-2xl bg-violet-50 border border-violet-100 p-4">

                <p className="text-sm text-violet-500">
                  Daily plan
                </p>

                <p className="text-2xl font-bold text-violet-700 mt-1">
                  SV ₹{calculatorResult.daily}
                </p>

                <p className="text-sm text-violet-500 mt-1">
                  for{" "}
                  {calculatorResult.days}{" "}
                  days
                </p>

              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">

                <button
                  onClick={
                    finalizeSavingsPlan
                  }
                  className="flex-1 rounded-2xl bg-violet-600 text-white py-3.5 font-semibold hover:bg-violet-700 active:scale-[0.98] transition"
                >
                  Finalize Savings Plan
                </button>

                <button
                  onClick={
                    clearCalculator
                  }
                  className="rounded-2xl border border-slate-200 px-6 py-3.5 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>

              </div>

            </div>
          )}

        </section>

        {/* =================================================
            SAVINGS PLANS
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-center justify-between mb-5">

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Savings Plans
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Each plan is connected to a matching savings goal.
              </p>

            </div>

            <div className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold">
              {savingsPlans.length}
            </div>

          </div>

          {savingsPlans.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">

              <p className="text-slate-400 text-sm">
                No savings plans yet.
              </p>

              <p className="text-slate-300 text-xs mt-1">
                Create a matching goal first.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {savingsPlans.map(
                (plan) => (

                  <div
                    key={plan.id}
                    className="rounded-2xl border border-slate-200 p-4 hover:border-violet-200 transition"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex gap-3">

                        <div className="min-w-12 h-12 px-2 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-700 font-bold text-sm">
                          SV
                          {plan.planNumber}
                        </div>

                        <div>

                          <p className="font-bold text-slate-900">
                            SV
                            {plan.planNumber}{" "}
                            ₹{plan.daily}
                          </p>

                          <p className="text-sm font-semibold text-blue-600 mt-1">
                            Goal:{" "}
                            {plan.goalName}
                          </p>

                          <p className="text-sm text-slate-500 mt-1">
                            Target ₹
                            {plan.target}
                          </p>

                          <p className="text-xs text-slate-400 mt-1">
                            {formatDate(
                              plan.startDate
                            )}{" "}
                            →{" "}
                            {formatDate(
                              plan.endDate
                            )}
                          </p>

                          <p className="text-xs text-slate-400">
                            {plan.days} days
                          </p>

                        </div>

                      </div>

                      <button
                        onClick={() =>
                          deleteSavingsPlan(
                            plan.id
                          )
                        }
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                )
              )}

            </div>

          )}

        </section>

        {/* =================================================
            SAVINGS GOALS
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-center justify-between mb-5">

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Savings Goals
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Add anything you want to save for.
              </p>

            </div>

            <button
              onClick={() =>
                setShowGoalForm(
                  !showGoalForm
                )
              }
              className="rounded-2xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold"
            >
              + Add Goal
            </button>

          </div>

          {showGoalForm && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 mb-5 space-y-3">

              <input
                type="text"
                placeholder="What do you want to buy?"
                value={goalNameInput}
                onChange={(e) =>
                  setGoalNameInput(
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:ring-2 focus:ring-slate-200"
              />

              <input
                type="number"
                min="1"
                placeholder="Target amount"
                value={goalTargetInput}
                onChange={(e) =>
                  setGoalTargetInput(
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:ring-2 focus:ring-slate-200"
              />

              <input
                type="date"
                min={addDays(
                  todayString,
                  1
                )}
                value={goalDateInput}
                onChange={(e) =>
                  setGoalDateInput(
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:ring-2 focus:ring-slate-200"
              />

              <div className="flex gap-3">

                <button
                  onClick={createGoal}
                  className="flex-1 rounded-2xl bg-slate-900 text-white py-3 font-semibold"
                >
                  Create Goal
                </button>

                <button
                  onClick={() => {
                    setShowGoalForm(false);
                    setGoalNameInput("");
                    setGoalTargetInput("");
                    setGoalDateInput("");
                  }}
                  className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600"
                >
                  Cancel
                </button>

              </div>

            </div>
          )}

          {goals.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">

              <p className="text-slate-400 text-sm">
                No savings goals added.
              </p>

              <p className="text-slate-300 text-xs mt-1">
                Add something you want to buy.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {goals.map(
                (goal) => {

                  const remaining =
                    Math.max(
                      0,
                      goal.target -
                        goal.saved
                    );

                  const daysLeft =
                    Math.max(
                      0,
                      getDateDifference(
                        todayString,
                        goal.targetDate
                      )
                    );

                  const dailyNeeded =
                    daysLeft > 0
                      ? remaining /
                        daysLeft
                      : 0;

                  const progress =
                    Math.min(
                      (goal.saved /
                        goal.target) *
                        100,
                      100
                    );

                  const connectedPlan =
                    savingsPlans.find(
                      (plan) =>
                        plan.goalId ===
                        goal.id
                    );

                  return (
                    <div
                      key={goal.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >

                      <div className="flex justify-between gap-3">

                        <div>

                          <p className="text-xl font-bold text-slate-900">
                            {goal.name}
                          </p>

                          <p className="text-sm text-slate-400 mt-1">
                            ₹{goal.saved} / ₹
                            {goal.target}
                          </p>

                        </div>

                        <button
                          onClick={() =>
                            deleteGoal(
                              goal.id
                            )
                          }
                          className="text-xs font-semibold text-red-500"
                        >
                          Delete
                        </button>

                      </div>

                      {connectedPlan && (
                        <div className="mt-4 rounded-2xl bg-violet-50 border border-violet-100 p-3">

                          <p className="text-xs text-violet-400">
                            Connected savings plan
                          </p>

                          <p className="font-bold text-violet-700 mt-1">
                            SV
                            {
                              connectedPlan.planNumber
                            }{" "}
                            ₹
                            {
                              connectedPlan.daily
                            }
                            /day
                          </p>

                        </div>
                      )}

                      <div className="mt-4">

                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">

                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{
                              width: `${progress}%`,
                            }}
                          />

                        </div>

                        <p className="text-xs text-slate-400 mt-2">
                          {Math.round(
                            progress
                          )}
                          % completed
                        </p>

                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">

                        <div className="bg-slate-50 rounded-xl p-3">

                          <p className="text-xs text-slate-400">
                            Remaining
                          </p>

                          <p className="font-bold">
                            ₹{remaining}
                          </p>

                        </div>

                        <div className="bg-slate-50 rounded-xl p-3">

                          <p className="text-xs text-slate-400">
                            Days left
                          </p>

                          <p className="font-bold">
                            {daysLeft}
                          </p>

                        </div>

                        <div className="bg-slate-50 rounded-xl p-3">

                          <p className="text-xs text-slate-400">
                            Daily need
                          </p>

                          <p className="font-bold">
                            ₹
                            {dailyNeeded.toFixed(
                              2
                            )}
                          </p>

                        </div>

                        <div className="bg-slate-50 rounded-xl p-3">

                          <p className="text-xs text-slate-400">
                            Target
                          </p>

                          <p className="font-bold text-xs">
                            {formatDate(
                              goal.targetDate
                            )}
                          </p>

                        </div>

                      </div>

                      <button
                        onClick={() => {
                          const value =
                            prompt(
                              `How much do you want to save for ${goal.name}?`
                            );

                          if (
                            value === null
                          ) {
                            return;
                          }

                          addMoneyToGoal(
                            goal.id,
                            Number(value)
                          );
                        }}
                        className="w-full mt-4 rounded-2xl border border-slate-200 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Add Money
                      </button>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* =================================================
            CALENDAR
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm mt-5">

          <div className="flex items-center justify-between mb-4">

            <button
              onClick={
                previousMonth
              }
              className="w-10 h-10 rounded-2xl border border-slate-200 text-xl text-slate-500 hover:bg-slate-50"
            >
              ‹
            </button>

            <div className="text-center">

              <h2 className="text-lg font-bold text-slate-900">
                {monthName}
              </h2>

              <button
                onClick={
                  goToCurrentMonth
                }
                className="text-xs text-violet-600 font-semibold mt-1"
              >
                Current month
              </button>

            </div>

            <button
              onClick={
                nextMonth
              }
              className="w-10 h-10 rounded-2xl border border-slate-200 text-xl text-slate-500 hover:bg-slate-50"
            >
              ›
            </button>

          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">

            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map(
              (day) => (
                <div
                  key={day}
                  className="text-center text-[10px] sm:text-xs font-semibold text-slate-400 py-2"
                >
                  {day}
                </div>
              )
            )}

          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">

            {Array.from(
              {
                length: firstDay,
              },
              (_, index) => (
                <div
                  key={`empty-${index}`}
                  className="min-h-[75px] sm:min-h-[100px]"
                />
              )
            )}

            {Array.from(
              {
                length:
                  daysInMonth,
              },
              (_, index) => {

                const day =
                  index + 1;

                const dateString =
                  `${calendarYear}-${String(
                    calendarMonth + 1
                  ).padStart(
                    2,
                    "0"
                  )}-${String(
                    day
                  ).padStart(
                    2,
                    "0"
                  )}`;

                const isLocked =
                  lockedDates.has(
                    dateString
                  );

                const isToday =
                  dateString ===
                  todayString;

                const plans =
                  getPlansForDate(
                    dateString
                  );

                const plannedTotal =
                  plans.reduce(
                    (total, plan) =>
                      total +
                      Number(
                        plan.daily
                      ),
                    0
                  );

                const overBudget =
                  plannedTotal >
                  DAILY_LIMIT;

                const remainingAfterPlan =
                  DAILY_LIMIT -
                  plannedTotal;

                return (
                  <div
                    key={dateString}
                    className={`min-h-[75px] sm:min-h-[100px] rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 ${
                      isLocked
                        ? "bg-red-50 border-red-200"
                        : isToday
                        ? "bg-emerald-50 border-emerald-300"
                        : "bg-slate-50 border-slate-100"
                    }`}
                  >

                    <div className="flex justify-between items-start">

                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          isLocked
                            ? "text-red-600"
                            : isToday
                            ? "text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {day}
                      </span>

                      {isToday && (
                        <span className="text-[7px] sm:text-[9px] font-bold text-emerald-600">
                          TODAY
                        </span>
                      )}

                    </div>

                    {plans.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">

                        {plans.map(
                          (plan) => (
                            <div
                              key={plan.id}
                              className="text-[8px] sm:text-[11px] font-bold text-violet-600 truncate"
                              title={
                                plan.goalName
                              }
                            >
                              SV
                              {
                                plan.planNumber
                              }{" "}
                              ₹
                              {
                                plan.daily
                              }
                            </div>
                          )
                        )}

                        <div className="mt-1 pt-1 border-t border-violet-100">

                          <p
                            className={`text-[8px] sm:text-[10px] font-bold ${
                              overBudget
                                ? "text-red-500"
                                : "text-slate-500"
                            }`}
                          >
                            Planned ₹
                            {
                              plannedTotal
                            }
                          </p>

                          {overBudget ? (
                            <p className="text-[7px] sm:text-[9px] font-bold text-red-500">
                              ⚠ Over ₹
                              {plannedTotal -
                                DAILY_LIMIT}
                            </p>
                          ) : (
                            <p className="text-[7px] sm:text-[9px] text-slate-400">
                              ₹
                              {
                                remainingAfterPlan
                              }{" "}
                              left
                            </p>
                          )}

                        </div>

                      </div>
                    )}

                    {isLocked && (
                      <p className="mt-2 text-[8px] sm:text-[10px] font-semibold text-red-500">
                        {dateString === todayString
                          ? debt > 0
                            ? `Recover ₹${debt}`
                            : "Locked"
                          : "Recovery day"}
                      </p>
                    )}

                  </div>
                );
              }
            )}

          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 pt-4 border-t border-slate-100">

            <div className="flex items-center gap-2">

              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />

              <span className="text-xs text-slate-500">
                Today
              </span>

            </div>

            <div className="flex items-center gap-2">

              <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />

              <span className="text-xs text-slate-500">
                Spending locked
              </span>

            </div>

            <div className="flex items-center gap-2">

              <span className="text-xs font-bold text-violet-600">
                SV1
              </span>

              <span className="text-xs text-slate-500">
                Savings plan
              </span>

            </div>

          </div>

        </section>

        {/* =================================================
            HISTORY
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-center justify-between mb-5">

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                History
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Your transactions
              </p>

            </div>

            <div className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              ₹{totalExpenses}
            </div>

          </div>

          {history.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">

              <p className="text-sm text-slate-400">
                No transactions yet.
              </p>

            </div>

          ) : (

            <div className="space-y-2">

              {[...history]
                .reverse()
                .map(
                  (item) => (

                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                    >

                      <div>

                        <p className="font-semibold text-sm text-slate-800">

                          {item.type ===
                          "saving"
                            ? "Actual Saving"
                            : item.type ===
                              "recovery"
                            ? "Debt Recovery"
                            : "Expense"}

                        </p>

                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(
                            item.date
                          )}
                        </p>

                      </div>

                      {item.type ===
                      "saving" ? (

                        <p className="font-bold text-blue-600">
                          +₹
                          {
                            item.amount
                          }
                        </p>

                      ) : item.type ===
                        "recovery" ? (

                        <p className="font-bold text-orange-500">
                          ₹
                          {
                            item.amount
                          }{" "}
                          recovered
                        </p>

                      ) : (

                        <p className="font-bold text-red-500">
                          -₹
                          {
                            item.amount
                          }
                        </p>

                      )}

                    </div>

                  )
                )}

            </div>

          )}

        </section>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="grid grid-cols-2 gap-3 mt-5">

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">

            <p className="text-xs text-slate-400">
              Total spent
            </p>

            <p className="text-2xl font-bold text-slate-900 mt-1">
              ₹{totalExpenses}
            </p>

          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">

            <p className="text-xs text-slate-400">
              Actually saved
            </p>

            <p className="text-2xl font-bold text-blue-600 mt-1">
              ₹{totalActualSavings}
            </p>

          </div>

        </div>

        {/* =================================================
            RESET
        ================================================= */}

        <div className="mt-6 mb-4">

          <button
            onClick={
              resetEverything
            }
            className="w-full rounded-2xl border border-red-200 bg-red-50 text-red-600 py-3.5 font-semibold hover:bg-red-100 active:scale-[0.98] transition"
          >
            Reset Everything
          </button>

          <p className="text-center text-xs text-slate-400 mt-2">
            This permanently deletes all
            budget data.
          </p>

        </div>

      </div>

      {/* =================================================
          GOAL SELECTION MODAL
      ================================================= */}

      {showGoalSelection && (

        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 sm:p-6">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Finalize SV
                </p>

                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Select a matching goal
                </h2>

                <p className="text-sm text-slate-500 mt-2">
                  Only a goal with the exact same
                  target amount can use this plan.
                </p>

              </div>

              <button
                onClick={() =>
                  setShowGoalSelection(false)
                }
                className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 font-bold"
              >
                ×
              </button>

            </div>

            {/* PLAN PREVIEW */}

            {calculatorResult && (
              <div className="mt-5 rounded-2xl bg-violet-50 border border-violet-100 p-4">

                <p className="text-xs text-violet-500">
                  New plan
                </p>

                <p className="text-xl font-bold text-violet-700 mt-1">
                  SV
                  {nextPlanNumber}{" "}
                  ₹
                  {
                    calculatorResult.daily
                  }
                  /day
                </p>

                <p className="text-sm font-semibold text-violet-600 mt-2">
                  Target: ₹
                  {
                    calculatorResult.target
                  }
                </p>

                <p className="text-xs text-violet-500 mt-1">
                  {
                    calculatorResult.days
                  }{" "}
                  days
                </p>

              </div>
            )}

            {/* MATCHING GOALS */}

            <div className="mt-5 space-y-3">

              {matchingGoalsForPlan.map(
                (goal) => {

                  const remaining =
                    Math.max(
                      0,
                      goal.target -
                        goal.saved
                    );

                  return (
                    <button
                      key={goal.id}
                      onClick={() =>
                        connectPlanToGoal(
                          goal.id
                        )
                      }
                      className="w-full text-left rounded-2xl border border-violet-200 bg-violet-50/50 p-4 hover:border-violet-400 hover:bg-violet-50 transition"
                    >

                      <div className="flex items-center justify-between gap-3">

                        <div>

                          <p className="font-bold text-slate-900">
                            {goal.name}
                          </p>

                          <p className="text-xs text-slate-400 mt-1">
                            Goal amount: ₹
                            {
                              goal.target
                            }
                          </p>

                          <p className="text-xs text-slate-400">
                            Saved: ₹
                            {
                              goal.saved
                            }
                          </p>

                        </div>

                        <div className="text-right">

                          <p className="text-xs text-slate-400">
                            Remaining
                          </p>

                          <p className="font-bold text-slate-700">
                            ₹
                            {
                              remaining
                            }
                          </p>

                        </div>

                      </div>

                      <div className="mt-3 pt-3 border-t border-violet-100">

                        <p className="text-xs font-semibold text-violet-600">
                          ✓ Amount matches ₹
                          {
                            calculatorResult.target
                          }
                        </p>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

            {/* NO MATCHING GOALS */}

            {matchingGoalsForPlan.length ===
              0 && (

              <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-100 p-4">

                <p className="font-semibold text-amber-700">
                  No matching savings goal
                </p>

                <p className="text-sm text-amber-600 mt-1">
                  Your calculator target is ₹
                  {
                    calculatorResult?.target
                  }.
                </p>

                <p className="text-sm text-amber-600 mt-1">
                  Create a savings goal with
                  exactly ₹
                  {
                    calculatorResult?.target
                  }{" "}
                  as its target amount.
                </p>

              </div>
            )}

            <button
              onClick={() =>
                setShowGoalSelection(false)
              }
              className="w-full mt-5 rounded-2xl border border-slate-200 py-3.5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

          </div>

        </div>

      )}

      {/* =================================================
          MOBILE NAVIGATION
      ================================================= */}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 md:hidden z-50">

        <div className="grid grid-cols-4 py-2">

          <button className="flex flex-col items-center gap-1 text-slate-700">

            <span className="text-lg">
              ⌂
            </span>

            <span className="text-[10px] font-semibold">
              Home
            </span>

          </button>

          <button className="flex flex-col items-center gap-1 text-slate-500">

            <span className="text-lg">
              +
            </span>

            <span className="text-[10px] font-semibold">
              Save
            </span>

          </button>

          <button className="flex flex-col items-center gap-1 text-slate-500">

            <span className="text-lg">
              □
            </span>

            <span className="text-[10px] font-semibold">
              Calendar
            </span>

          </button>

          <button className="flex flex-col items-center gap-1 text-slate-500">

            <span className="text-lg">
              ≡
            </span>

            <span className="text-[10px] font-semibold">
              History
            </span>

          </button>

        </div>

      </nav>

    </div>
  );
}

export default App;
