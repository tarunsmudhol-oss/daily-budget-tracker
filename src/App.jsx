import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

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
   DEBT CALCULATION HELPERS
   ===================================================== */

function calculateDebtThroughDate(historyItems, targetDate) {
  const expenses = (historyItems || [])
    .filter((item) => item.type === "expense" && item.date <= targetDate)
    .map((item) => ({
      date: item.date,
      amount: Number(item.amount || 0),
    }))
    .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (expenses.length === 0) return 0;

  let debt = 0;
  let currentDate = expenses[0].date;
  let index = 0;

  while (currentDate <= targetDate) {
    // Starting from the second day, recover up to ₹70 before
    // that day's spending is considered.
    if (currentDate !== expenses[0].date) {
      debt = Math.max(0, debt - DAILY_LIMIT);
    }

    let daySpent = 0;

    while (
      index < expenses.length &&
      expenses[index].date === currentDate
    ) {
      daySpent += expenses[index].amount;
      index += 1;
    }

    if (debt > 0) {
      // A recovery day is locked. Any existing historical expense
      // on a locked day is therefore added to the debt.
      debt += daySpent;
    } else {
      debt = Math.max(0, daySpent - DAILY_LIMIT);
    }

    if (currentDate === targetDate) break;
    currentDate = addDays(currentDate, 1);
  }

  return debt;
}

function rebuildExpenseDebtAfter(historyItems) {
  const expenses = (historyItems || [])
    .filter((item) => item.type === "expense")
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return Number(a.id || 0) - Number(b.id || 0);
    });

  if (expenses.length === 0) return historyItems || [];

  const allDates = [...new Set(expenses.map((item) => item.date))].sort();
  let debt = 0;
  let dateIndex = 0;
  const debtByDate = new Map();

  for (const date of allDates) {
    if (dateIndex > 0) {
      const previousDate = allDates[dateIndex - 1];
      const daysPassed = getDateDifference(previousDate, date);

      for (let i = 0; i < daysPassed; i += 1) {
        debt = Math.max(0, debt - DAILY_LIMIT);
        if (debt <= 0) break;
      }
    }

    const daySpent = expenses
      .filter((item) => item.date === date)
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    debt = debt > 0
      ? debt + daySpent
      : Math.max(0, daySpent - DAILY_LIMIT);

    debtByDate.set(date, debt);
    dateIndex += 1;
  }

  return (historyItems || []).map((item) => {
    if (item.type !== "expense") return item;

    return {
      ...item,
      debtAfter: debtByDate.get(item.date) || 0,
    };
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
     DAILY BUDGET DATE VIEW
  ===================================================== */

  const [selectedDate, setSelectedDate] = useState(todayString);

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
  const [cloudLoadSucceeded, setCloudLoadSucceeded] =
    useState(false);

  /* =====================================================
     SUPABASE AUTH
  ===================================================== */

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  /* =====================================================
     IMMEDIATE USER PERSISTENCE
  ===================================================== */

  const saveLocalUserData = (overrides = {}) => {
    if (!user?.id) return;

    const payload = {
      spentToday,
      debt,
      lastDate,
      goals,
      savingsPlans,
      nextPlanNumber,
      history,
      calculatorTarget,
      calculatorDaily,
      ...overrides,
      _savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(
        `budgetData_${user.id}`,
        JSON.stringify(payload)
      );
      localStorage.setItem(
        `budgetGoals_${user.id}`,
        JSON.stringify(payload.goals || [])
      );
      localStorage.setItem(
        `budgetCalculator_${user.id}`,
        JSON.stringify({
          target: payload.calculatorTarget ?? "",
          daily: payload.calculatorDaily ?? "",
        })
      );
      localStorage.setItem(
        `budgetSavingsPlans_${user.id}`,
        JSON.stringify(payload.savingsPlans || [])
      );
    } catch (error) {
      console.error("Could not save local user data:", error);
    }

    return payload;
  };

  /* =====================================================
     SUPABASE AUTH SESSION
  ===================================================== */

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setUser(session?.user || null);
      setAuthReady(true);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        setAuthReady(true);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =====================================================
     LOAD USER DATA
  ===================================================== */

  useEffect(() => {
    if (!authReady || !user) {
      if (authReady && !user) {
        setDataLoaded(true);
      }
      return;
    }

    let cancelled = false;

    const loadUserData = async () => {
      setDataLoaded(false);
      setCloudLoadSucceeded(false);
      setAuthError("");

      const { data, error } = await supabase
        .from("budget_data")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Error loading cloud data:", error);
        setAuthError(
          "Could not load your saved data. Your existing cloud data was NOT overwritten. Please check Supabase/Vercel settings and reload."
        );
        // CRITICAL: never mark data as loaded after a cloud-read failure.
        // Otherwise the save effect could overwrite real cloud data with
        // empty/default React state during a deployment or connection error.
        setDataLoaded(false);
        setCloudLoadSucceeded(false);
        return;
      }

      let sourceData = data?.data || null;

      // Keep a user-specific browser backup as a safety net.
      // This prevents a goal/plan/calculator value from disappearing if the
      // browser is closed before Supabase finishes an upsert or if an older
      // cloud record is missing newly added fields.
      const userBackupKey = `budgetData_${user.id}`;
      let localUserData = null;

      try {
        const rawUserBackup = localStorage.getItem(userBackupKey);
        if (rawUserBackup) {
          localUserData = JSON.parse(rawUserBackup);
        }
      } catch (backupError) {
        console.error("Could not read user backup:", backupError);
      }

      // Merge the user-specific local backup with cloud data.
      // Cloud remains the main source, but locally saved goals/calculator/plans
      // are restored when the cloud copy is older or missing those fields.
      if (localUserData) {
        const cloudTime = Date.parse(sourceData?._savedAt || data?.updated_at || "") || 0;
        const localTime = Date.parse(localUserData?._savedAt || "") || 0;

        if (!sourceData || localTime > cloudTime) {
          sourceData = {
            ...(sourceData || {}),
            ...localUserData,
          };
        } else {
          sourceData = {
            ...localUserData,
            ...sourceData,
            goals:
              Array.isArray(sourceData.goals) && sourceData.goals.length > 0
                ? sourceData.goals
                : localUserData.goals || [],
            savingsPlans:
              Array.isArray(sourceData.savingsPlans) && sourceData.savingsPlans.length > 0
                ? sourceData.savingsPlans
                : localUserData.savingsPlans || [],
            calculatorTarget:
              sourceData.calculatorTarget != null
                ? sourceData.calculatorTarget
                : localUserData.calculatorTarget ?? "",
            calculatorDaily:
              sourceData.calculatorDaily != null
                ? sourceData.calculatorDaily
                : localUserData.calculatorDaily ?? "",
          };
        }
      }

      // Dedicated browser backups are used as a final fallback for the same user.
      try {
        const savedGoals = JSON.parse(
          localStorage.getItem(`budgetGoals_${user.id}`) || "null"
        );
        const savedCalculator = JSON.parse(
          localStorage.getItem(`budgetCalculator_${user.id}`) || "null"
        );
        const savedPlans = JSON.parse(
          localStorage.getItem(`budgetSavingsPlans_${user.id}`) || "null"
        );

        if (!sourceData && (Array.isArray(savedGoals) || Array.isArray(savedPlans) || savedCalculator)) {
          sourceData = {
            goals: Array.isArray(savedGoals) ? savedGoals : [],
            savingsPlans: Array.isArray(savedPlans) ? savedPlans : [],
            calculatorTarget: savedCalculator?.target ?? "",
            calculatorDaily: savedCalculator?.daily ?? "",
            spentToday: 0,
            debt: 0,
            lastDate: todayString,
            nextPlanNumber: 1,
            history: [],
            _savedAt: new Date().toISOString(),
          };
        } else if (sourceData) {
          if ((!Array.isArray(sourceData.goals) || sourceData.goals.length === 0) && Array.isArray(savedGoals)) {
            sourceData.goals = savedGoals;
          }
          if ((!Array.isArray(sourceData.savingsPlans) || sourceData.savingsPlans.length === 0) && Array.isArray(savedPlans)) {
            sourceData.savingsPlans = savedPlans;
          }
          if (sourceData.calculatorTarget == null && savedCalculator) {
            sourceData.calculatorTarget = savedCalculator.target ?? "";
          }
          if (sourceData.calculatorDaily == null && savedCalculator) {
            sourceData.calculatorDaily = savedCalculator.daily ?? "";
          }
        }
      } catch (backupError) {
        console.error("Could not restore dedicated user backup:", backupError);
      }

      // Migrate the old single-user local data once if this account has no cloud data yet.
      if (!sourceData) {
        const localData = localStorage.getItem("budgetData");

        if (localData) {
          try {
            sourceData = JSON.parse(localData);

            const { error: migrationError } =
              await supabase.from("budget_data").upsert(
                {
                  user_id: user.id,
                  data: sourceData,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              );

            if (migrationError) {
              console.error(
                "Local data migration failed:",
                migrationError
              );
            }
          } catch (migrationError) {
            console.error(
              "Could not read local data:",
              migrationError
            );
          }
        }
      }

      if (!sourceData) {
        setDataLoaded(true);
        return;
      }

      try {
        let currentDebt = Number(sourceData.debt || 0);
        let currentSpent = Number(sourceData.spentToday || 0);

        const currentHistory = [
          ...(sourceData.history || []),
        ];

        const savedDate =
          sourceData.lastDate || todayString;

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
            if (currentDebt <= 0) break;

            const recoveryDate =
              addDays(savedDate, i);

            const debtBefore = currentDebt;

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

        // Rebuild the real debt from the complete expense history.
        // This is important when an expense was entered for an older date
        // such as 15-Aug while the current date is already 17-Aug.
        const hasExpenses = currentHistory.some(
          (item) => item.type === "expense"
        );

        if (hasExpenses) {
          currentDebt = calculateDebtThroughDate(
            currentHistory,
            todayString
          );

          currentSpent = currentHistory
            .filter(
              (item) =>
                item.type === "expense" &&
                item.date === todayString
            )
            .reduce(
              (total, item) => total + Number(item.amount || 0),
              0
            );
        }

        const savedPlans =
          sourceData.savingsPlans || [];

        const highestPlanNumber =
          savedPlans.reduce(
            (highest, plan) =>
              Math.max(
                highest,
                Number(plan.planNumber || 0)
              ),
            0
          );

        setSpentToday(currentSpent);
        setDebt(currentDebt);
        setLastDate(todayString);
        setGoals(Array.isArray(sourceData.goals) ? sourceData.goals : []);
        setSavingsPlans(Array.isArray(savedPlans) ? savedPlans : []);

        // Restore the Savings Calculator inputs too.
        // These used to exist only in React state, so they were lost on logout/login.
        setCalculatorTarget(
          sourceData.calculatorTarget != null
            ? String(sourceData.calculatorTarget)
            : ""
        );
        setCalculatorDaily(
          sourceData.calculatorDaily != null
            ? String(sourceData.calculatorDaily)
            : ""
        );

        setNextPlanNumber(
          Math.max(
            highestPlanNumber + 1,
            Number(
              sourceData.nextPlanNumber || 1
            )
          )
        );

          setHistory(currentHistory);
        setSelectedDate(todayString);
      } catch (error) {
        console.error(
          "Error processing cloud data:",
          error
        );
        setAuthError(
          "Your saved data could not be read."
        );
      }

      // The cloud read completed successfully. Only now may the save effect run.
      setCloudLoadSucceeded(true);
      setDataLoaded(true);
    };

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, todayString]);

  /* =====================================================
     SAVE USER DATA
  ===================================================== */

  useEffect(() => {
    if (
      !authReady ||
      !user ||
      !dataLoaded ||
      !cloudLoadSucceeded
    ) {
      return;
    }

    const saveUserData = async () => {
      const payload = {
        spentToday,
        debt,
        lastDate,
        goals,
        savingsPlans,
        nextPlanNumber,
        history,

        // Persist Savings Calculator inputs so they survive logout/login.
        calculatorTarget,
        calculatorDaily,

        // Version the local/cloud copy so the newest copy wins on next login.
        _savedAt: new Date().toISOString(),
      };

      // Save immediately to a user-specific browser backup as well.
      // This is not a replacement for Supabase; it is a fallback for the same browser.
      try {
        localStorage.setItem(
          `budgetData_${user.id}`,
          JSON.stringify(payload)
        );
      } catch (backupError) {
        console.error("Could not save local user backup:", backupError);
      }

      const { error } = await supabase
        .from("budget_data")
        .upsert(
          {
            user_id: user.id,
            data: payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error(
          "Error saving cloud data:",
          error
        );
        setAuthError(
          "Could not save your latest changes."
        );
      }
    };

    saveUserData();
  }, [
    authReady,
    user,
    dataLoaded,
    cloudLoadSucceeded,
    spentToday,
    debt,
    lastDate,
    goals,
    savingsPlans,
    nextPlanNumber,
    history,
    calculatorTarget,
    calculatorDaily,
  ]);

  /* =====================================================
     AUTH ACTIONS
  ===================================================== */

  const handleAuth = async (event) => {
    event.preventDefault();

    setAuthError("");
    setAuthMessage("");

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setAuthError(
        "Enter your email and password."
      );
      return;
    }

    if (password.length < 6) {
      setAuthError(
        "Password must be at least 6 characters."
      );
      return;
    }

    setAuthLoading(true);

    if (authMode === "signup") {
      const { data, error } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (error) {
        setAuthError(error.message);
      } else if (!data.session) {
        setAuthMessage(
          "Account created. Check your email to confirm your account, then log in."
        );
        setAuthMode("login");
      }
    } else {
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setAuthError(error.message);
      }
    }

    setAuthLoading(false);
  };

  const handleLogout = async () => {
    // Save the latest state synchronously to browser storage before signing out.
    // This prevents the last goal/calculator edit from being lost during logout.
    saveLocalUserData();

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setUser(null);
    setDataLoaded(false);
    setCloudLoadSucceeded(false);
  };

  /* =====================================================
     DAILY BUDGET DATE VALUES
  ===================================================== */

  const selectedDayItems = useMemo(() => {
    return history.filter((item) => item.date === selectedDate);
  }, [history, selectedDate]);

  const selectedSpent = useMemo(() => {
    return selectedDayItems
      .filter((item) => item.type === "expense")
      .reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );
  }, [selectedDayItems]);

  const selectedDebt = useMemo(() => {
    return calculateDebtThroughDate(history, selectedDate);
  }, [history, selectedDate]);

  const selectedAvailable =
    selectedDebt > 0
      ? 0
      : Math.max(0, DAILY_LIMIT - selectedSpent);

  const previousBudgetDay = () => {
    setSelectedDate((current) => addDays(current, -1));
  };

  const nextBudgetDay = () => {
    setSelectedDate((current) => {
      const next = addDays(current, 1);
      return next > todayString ? current : next;
    });
  };

  const goToBudgetToday = () => {
    setSelectedDate(todayString);
  };

  /* =====================================================
     AVAILABLE TODAY
  ===================================================== */

  const availableToday = selectedAvailable;

  /* =====================================================
     ADD EXPENSE
  ===================================================== */

  const addExpense = () => {
    const amount = Number(expenseInput);

    if (!amount || amount <= 0) {
      alert("Enter a valid expense amount.");
      return;
    }

    if (selectedDate > todayString) {
      return;
    }

    // CALENDAR LOCK IS VISUAL ONLY.
    // The user can still add/edit expenses on locked dates.
    // Every new expense recalculates the recovery period.

    const newExpense = {
      id: Date.now(),
      type: "expense",
      amount,
      date: selectedDate,
      debtAfter: 0,
    };

    setHistory((previous) => {
      const nextHistory = [
        ...previous,
        newExpense,
      ];

      const rebuiltHistory = rebuildExpenseDebtAfter(nextHistory);
      const currentDebt = calculateDebtThroughDate(
        rebuiltHistory,
        todayString
      );

      if (selectedDate === todayString) {
        const todaySpent = rebuiltHistory
          .filter(
            (item) =>
              item.type === "expense" &&
              item.date === todayString
          )
          .reduce(
            (total, item) => total + Number(item.amount || 0),
            0
          );

        setSpentToday(todaySpent);
        setDebt(currentDebt);
      } else {
        // This is the important fix for retroactive entries.
        // Adding ₹2,116 on 15-Aug must also update today's debt
        // and lock the current/future recovery days.
        setDebt(currentDebt);
      }

      return rebuiltHistory;
    });

    setExpenseInput("");

    // Calculate the final debt after adding the new expense so the
    // user gets an immediate explanation when the limit is exceeded.
    const projectedHistory = rebuildExpenseDebtAfter([
      ...history,
      newExpense,
    ]);
    const projectedTodayDebt = calculateDebtThroughDate(
      projectedHistory,
      todayString
    );

    if (projectedTodayDebt > 0) {
      const daySpent = projectedHistory
        .filter(
          (item) =>
            item.type === "expense" &&
            item.date === selectedDate
        )
        .reduce(
          (total, item) => total + Number(item.amount || 0),
          0
        );

      if (daySpent > DAILY_LIMIT) {
        alert(
          `Daily limit exceeded.\n\n` +
          `Spent on ${formatDate(selectedDate)}: ₹${daySpent}\n` +
          `Daily limit: ₹${DAILY_LIMIT}\n\n` +
          `Spending is now LOCKED until the debt is fully recovered.`
        );
      }
    }
  };

  /* =====================================================
     EDIT EXPENSE
  ===================================================== */

  const editExpense = (expenseId) => {
    const expense = history.find(
      (item) => item.id === expenseId && item.type === "expense"
    );

    if (!expense) return;

    const value = window.prompt(
      `Edit expense for ${formatDate(expense.date)}\n\nEnter the new amount:`,
      String(expense.amount)
    );

    if (value === null) return;

    const newAmount = Number(value);

    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      alert("Enter a valid expense amount.");
      return;
    }

    const updatedHistory = history.map((item) =>
      item.id === expenseId
        ? { ...item, amount: newAmount }
        : item
    );

    const rebuiltHistory = rebuildExpenseDebtAfter(updatedHistory);
    const currentDebt = calculateDebtThroughDate(
      rebuiltHistory,
      todayString
    );

    const todaySpent = rebuiltHistory
      .filter(
        (item) =>
          item.type === "expense" &&
          item.date === todayString
      )
      .reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

    setHistory(rebuiltHistory);
    setDebt(currentDebt);
    setSpentToday(todaySpent);

    // If an edited historical expense now creates or removes debt,
    // immediately reflect that in the current day as well.
    if (currentDebt > 0) {
      alert(
        `Updated successfully.\n\n` +
        `Current recovery debt: ₹${currentDebt}\n` +
        `Spending remains locked until the debt is recovered.`
      );
    }
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

    const updatedGoals = [
      ...goals,
      newGoal,
    ];

    setGoals(updatedGoals);
    saveLocalUserData({ goals: updatedGoals });

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

    const updatedGoals = goals.filter(
      (goal) => goal.id !== goalId
    );

    setGoals(updatedGoals);
    saveLocalUserData({ goals: updatedGoals });
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

    const updatedGoals = goals.map((goal) => {
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
    });

    setGoals(updatedGoals);
    saveLocalUserData({ goals: updatedGoals });

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

    const updatedPlans = [
      ...savingsPlans,
      newPlan,
    ];

    setSavingsPlans(updatedPlans);
    setNextPlanNumber(nextPlanNumber + 1);
    saveLocalUserData({
      savingsPlans: updatedPlans,
      nextPlanNumber: nextPlanNumber + 1,
    });

    setShowGoalSelection(false);

    // Keep the calculator values visible and persisted after creating a plan.
    saveLocalUserData({
      calculatorTarget,
      calculatorDaily,
      savingsPlans: updatedPlans,
      nextPlanNumber: nextPlanNumber + 1,
    });

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

    const updatedPlans = savingsPlans.filter(
      (item) => item.id !== planId
    );

    setSavingsPlans(updatedPlans);
    saveLocalUserData({ savingsPlans: updatedPlans });
  };

  /* =====================================================
     CLEAR CALCULATOR
  ===================================================== */

  const clearCalculator = () => {
    setCalculatorTarget("");
    setCalculatorDaily("");
    saveLocalUserData({
      calculatorTarget: "",
      calculatorDaily: "",
    });
  };

  /* =====================================================
     RESET EVERYTHING
  ===================================================== */

  const resetEverything = async () => {
    const confirmed =
      window.confirm(
        "Are you sure you want to reset EVERYTHING?\n\n" +
        "All expenses, debt, savings goals, savings plans, history and saved data will be permanently deleted."
      );

    if (!confirmed) {
      return;
    }

    if (user) {
      const { error } = await supabase
        .from("budget_data")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        setAuthError(
          "Could not reset your cloud data."
        );
        return;
      }
    }

    localStorage.removeItem(
      "budgetData"
    );

    if (user?.id) {
      localStorage.removeItem(`budgetData_${user.id}`);
      localStorage.removeItem(`budgetGoals_${user.id}`);
      localStorage.removeItem(`budgetCalculator_${user.id}`);
      localStorage.removeItem(`budgetSavingsPlans_${user.id}`);
    }

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
     DEBT RECOVERY CALENDAR
  ===================================================== */

  /* =====================================================
     COMPLETE RECOVERY SCHEDULE

     IMPORTANT:
     A debt can be created by entering an expense for ANY past
     date. Once that happens, the lock starts from that past date
     and continues through TODAY and into future recovery days
     until the complete debt reaches ₹0.
  ===================================================== */

  const recoveryStartDate = useMemo(() => {
    if (debt <= 0) return null;

    const expenses = history
      .filter(
        (item) =>
          item.type === "expense" &&
          item.date <= todayString
      )
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return Number(a.id || 0) - Number(b.id || 0);
      });

    if (expenses.length === 0) return null;

    let runningDebt = 0;
    let previousDate = expenses[0].date;
    let currentOutstandingStart = null;

    const dates = [...new Set(expenses.map((item) => item.date))].sort();

    for (const date of dates) {
      if (date !== previousDate) {
        const daysPassed = getDateDifference(previousDate, date);

        for (let day = 1; day < daysPassed; day += 1) {
          if (runningDebt > 0) {
            runningDebt = Math.max(0, runningDebt - DAILY_LIMIT);
            if (runningDebt === 0) {
              currentOutstandingStart = null;
            }
          }
        }

        // Recover on the date immediately before the next expense date.
        if (daysPassed > 0 && runningDebt > 0) {
          runningDebt = Math.max(0, runningDebt - DAILY_LIMIT);
          if (runningDebt === 0) {
            currentOutstandingStart = null;
          }
        }
      }

      const daySpent = expenses
        .filter((item) => item.date === date)
        .reduce(
          (total, item) => total + Number(item.amount || 0),
          0
        );

      if (runningDebt > 0) {
        runningDebt += daySpent;
      } else {
        runningDebt = Math.max(0, daySpent - DAILY_LIMIT);
      }

      if (runningDebt > 0) {
        if (!currentOutstandingStart) {
          currentOutstandingStart = date;
        }
      } else {
        currentOutstandingStart = null;
      }

      previousDate = date;
    }

    return currentOutstandingStart;
  }, [history, todayString, debt]);

  const recoveryDays =
    debt > 0
      ? Math.ceil(debt / DAILY_LIMIT)
      : 0;

  const lockedDates = useMemo(() => {
    const dates = new Set();

    if (debt <= 0 || !recoveryStartDate) {
      return dates;
    }

    // LOCK EVERY DATE from the date that created the outstanding debt
    // through today. This includes dates where no expense was entered.
    let cursor = recoveryStartDate;
    while (cursor <= todayString) {
      dates.add(cursor);
      cursor = addDays(cursor, 1);
    }

    // Continue the lock into the future until today's outstanding debt
    // is fully recovered.
    for (let i = 1; i <= recoveryDays; i += 1) {
      dates.add(addDays(todayString, i));
    }

    return dates;
  }, [
    debt,
    recoveryStartDate,
    todayString,
    recoveryDays,
  ]);

  const getRecoveryAmountForDate = (dateString) => {
    if (debt <= 0 || !recoveryStartDate) return 0;

    // The day on which the debt is created does not recover anything.
    if (dateString <= recoveryStartDate) {
      return 0;
    }

    // Future recovery is calculated from the current outstanding debt.
    if (dateString > todayString) {
      const daysFromToday = getDateDifference(
        todayString,
        dateString
      );

      if (daysFromToday < 1 || daysFromToday > recoveryDays) {
        return 0;
      }

      const recoveredBefore =
        (daysFromToday - 1) * DAILY_LIMIT;

      return Math.min(
        DAILY_LIMIT,
        Math.max(0, debt - recoveredBefore)
      );
    }

    // For a past/current date, calculate the debt immediately before
    // that date. This makes the calendar correctly show recovery days
    // even when the original overspending was entered later for a past day.
    const dayBefore = addDays(dateString, -1);
    const debtBeforeDate = calculateDebtThroughDate(
      history,
      dayBefore
    );

    if (debtBeforeDate <= 0) return 0;

    return Math.min(DAILY_LIMIT, debtBeforeDate);
  };

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

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-7 text-center w-full max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 font-bold">
            ₹
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-4">
            Daily Budget Tracker
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Loading your account...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="w-full max-w-md">

          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-violet-100 flex items-center justify-center text-violet-700 text-xl font-bold shadow-sm">
              ₹
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mt-4">
              Daily Budget Tracker
            </h1>

            <p className="text-sm text-slate-500 mt-2">
              {authMode === "login"
                ? "Log in to access your personal budget."
                : "Create your personal budget account."}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">

            <div className="grid grid-cols-2 bg-slate-100 rounded-2xl p-1 mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setAuthMessage("");
                }}
                className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                  authMode === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setAuthError("");
                  setAuthMessage("");
                }}
                className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                  authMode === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={handleAuth}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Email
                </label>

                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) =>
                    setAuthEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full mt-1.5 rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Password
                </label>

                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) =>
                    setAuthPassword(event.target.value)
                  }
                  placeholder="Minimum 6 characters"
                  autoComplete={
                    authMode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  className="w-full mt-1.5 rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>

              {authError && (
                <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  {authError}
                </div>
              )}

              {authMessage && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold disabled:opacity-50 active:scale-[0.98] transition"
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            Each account has its own separate budget data.
          </p>
        </div>
      </div>
    );
  }

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

          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="text-xs text-slate-400 truncate">
              Signed in as {user.email}
            </p>

            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
            >
              Logout
            </button>
          </div>

        </header>

        {/* TOP CARDS */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* TODAY CARD */}

          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-sm font-medium text-slate-400">
                  {selectedDate === todayString ? "Today's budget" : "Daily budget"}
                </p>

                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Daily Limit
                </h2>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={previousBudgetDay}
                    className="w-8 h-8 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition"
                    aria-label="Previous day"
                  >
                    ←
                  </button>

                  <button
                    onClick={goToBudgetToday}
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    {formatDate(selectedDate)}
                  </button>

                  <button
                    onClick={nextBudgetDay}
                    disabled={selectedDate >= todayString}
                    className="w-8 h-8 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Next day"
                  >
                    →
                  </button>
                </div>

              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                ₹
              </div>

            </div>

            <div className="mt-6">

              <p className="text-sm text-slate-400">
                Available on this day
              </p>

              <p
                className={`text-4xl font-bold mt-1 ${
                  selectedDebt > 0
                    ? "text-red-500"
                    : "text-emerald-600"
                }`}
              >
                ₹{selectedAvailable}
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">

              <div className="bg-slate-50 rounded-2xl p-4">

                <p className="text-xs text-slate-400">
                  Spent
                </p>

                <p className="text-lg font-bold mt-1">
                  ₹{selectedSpent}
                </p>

              </div>

              <div className="bg-red-50 rounded-2xl p-4">

                <p className="text-xs text-red-400">
                  Debt
                </p>

                <p className="text-lg font-bold text-red-500 mt-1">
                  ₹{selectedDebt}
                </p>

              </div>

            </div>

            {selectedDebt > 0 && (
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
                min="1"
                placeholder="Enter expense amount for this day"
                value={expenseInput}
                onChange={(e) =>
                  setExpenseInput(
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-slate-200"
              />

              <div className="grid grid-cols-2 gap-3">

                <button
                  onClick={addExpense}
                  className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-800 active:scale-[0.98] transition"
                >
                  Add Expense
                </button>

                <button
                  onClick={() => {
                    const expensesForDay = history.filter(
                      (item) => item.type === "expense" && item.date === selectedDate
                    );

                    if (expensesForDay.length === 0) {
                      alert("There is no expense to edit for this day.");
                      return;
                    }

                    editExpense(expensesForDay[expensesForDay.length - 1].id);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white text-slate-700 py-3.5 font-semibold hover:bg-slate-50 active:scale-[0.98] transition"
                >
                  Edit Spent
                </button>

              </div>

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
                ₹
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
            CALENDAR
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-sm mt-4 sm:mt-5">

          <div className="flex items-center justify-between mb-3 sm:mb-4">

            <button
              onClick={
                previousMonth
              }
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border border-slate-200 text-lg sm:text-xl text-slate-500 hover:bg-slate-50 active:scale-95 transition"
            >
              ‹
            </button>

            <div className="text-center">

              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {monthName}
              </h2>

              <button
                onClick={
                  goToCurrentMonth
                }
                className="text-[10px] sm:text-xs text-violet-600 font-semibold mt-0.5"
              >
                Current month
              </button>

              <p className="hidden sm:block text-[10px] text-slate-400 mt-1">
                Red = spending locked • Violet = savings plan
              </p>

            </div>

            <button
              onClick={
                nextMonth
              }
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border border-slate-200 text-lg sm:text-xl text-slate-500 hover:bg-slate-50 active:scale-95 transition"
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
                  className="text-center text-[9px] sm:text-xs font-semibold text-slate-400 py-1.5 sm:py-2"
                >
                  {day}
                </div>
              )
            )}

          </div>

          <div className="w-full overflow-x-auto overflow-y-hidden -mx-1 px-1 pb-2 overscroll-x-contain">

            <div className="grid grid-cols-7 gap-2 sm:gap-2 min-w-[560px] sm:min-w-0 sm:w-full">

              {Array.from(
                {
                  length: firstDay,
                },
                (_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="aspect-square w-full"
                  />
                )
              )}

              {Array.from(
                {
                  length: daysInMonth,
                },
                (_, index) => {

                  const day = index + 1;

                  const dateString =
                    `${calendarYear}-${String(
                      calendarMonth + 1
                    ).padStart(2, "0")}-${String(
                      day
                    ).padStart(2, "0")}`;

                  const isLocked =
                    lockedDates.has(dateString);

                  const isToday =
                    dateString === todayString;

                  const plans =
                    getPlansForDate(dateString);

                  const plannedTotal =
                    plans.reduce(
                      (total, plan) =>
                        total + Number(plan.daily),
                      0
                    );

                  const overBudget =
                    plannedTotal > DAILY_LIMIT;

                  const remainingAfterPlan =
                    DAILY_LIMIT - plannedTotal;

                  return (
                    <div
                      key={dateString}
                      className={`relative aspect-square min-w-0 w-full rounded-xl border p-2 sm:p-2 overflow-hidden ${
                        isLocked
                          ? "bg-red-50 border-red-200"
                          : isToday
                          ? "bg-emerald-50 border-emerald-300"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >

                      {/* DATE + TODAY */}

                      <div className="flex items-center justify-between gap-0.5">

                        <span
                          className={`text-xs sm:text-sm font-bold leading-none ${
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
                          <span className="text-[7px] sm:text-[8px] font-extrabold text-emerald-600 leading-none">
                            TODAY
                          </span>
                        )}

                      </div>

                      {/* SAVINGS PLANS */}

                      {plans.length > 0 && (
                        <div className="mt-1 space-y-0.5">

                          {plans.map((plan) => (
                            <div
                              key={plan.id}
                              title={plan.goalName}
                              className="text-[10px] sm:text-[10px] font-bold text-violet-600 leading-3 truncate"
                            >
                              SV{plan.planNumber} ₹{plan.daily}
                            </div>
                          ))}

                          {/* PLANNED */}

                          <div className="border-t border-violet-100 pt-[1px] mt-[1px]">

                            <p
                              className={`text-[9px] sm:text-[9px] font-bold leading-3 truncate ${
                                overBudget
                                  ? "text-red-500"
                                  : "text-slate-500"
                              }`}
                            >
                              Planned ₹{plannedTotal}
                            </p>

                            {/* LEFT */}

                            {overBudget ? (
                              <p className="text-[9px] sm:text-[8px] font-bold text-red-500 leading-3 truncate">
                                Over ₹{plannedTotal - DAILY_LIMIT}
                              </p>
                            ) : (
                              <p className="text-[9px] sm:text-[8px] text-slate-400 leading-3 truncate">
                                ₹{remainingAfterPlan} left
                              </p>
                            )}

                          </div>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100">

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
            DEBT RECOVERY PLAN
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0 font-bold">
              ₹
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Debt Recovery Plan
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Your extra spending is recovered from future daily budgets.
              </p>
            </div>
          </div>

          {debt > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                <div className="rounded-2xl bg-red-50 border border-red-100 p-3">
                  <p className="text-[11px] text-red-500">Current Debt</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">
                    ₹{debt}
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 border border-orange-100 p-3">
                  <p className="text-[11px] text-orange-500">
                    Recovery / Day
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">
                    ₹{DAILY_LIMIT}
                  </p>
                </div>

                <div className="rounded-2xl bg-violet-50 border border-violet-100 p-3">
                  <p className="text-[11px] text-violet-500">
                    Recovery Days
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-violet-600 mt-1">
                    {recoveryDays}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[11px] text-slate-500">
                    Debt Clears
                  </p>
                  <p className="text-sm sm:text-base font-bold text-slate-800 mt-2">
                    {formatDate(
                      addDays(
                        todayString,
                        recoveryDays
                      )
                    )}
                  </p>
                </div>

              </div>

              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      Recovery Schedule
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      Starting {formatDate(
                        addDays(todayString, 1)
                      )}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-white border border-red-100 px-3 py-1 text-xs font-bold text-red-600">
                    ₹{debt} total
                  </span>
                </div>

                <div className="mt-4 max-h-[420px] overflow-y-auto pr-1 sm:pr-2 rounded-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                  {Array.from(
                    { length: recoveryDays },
                    (_, index) => {
                      const recoveryDate =
                        addDays(
                          todayString,
                          index + 1
                        );

                      const amount =
                        Math.min(
                          DAILY_LIMIT,
                          Math.max(
                            0,
                            debt -
                              index *
                                DAILY_LIMIT
                          )
                        );

                      const remainingAfter =
                        Math.max(
                          0,
                          debt -
                            (index + 1) *
                              DAILY_LIMIT
                        );

                      return (
                        <div
                          key={recoveryDate}
                          className="rounded-2xl bg-white border border-red-100 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-700">
                              Day {index + 1}
                            </p>

                            <p className="text-sm font-bold text-red-600">
                              ₹{amount}
                            </p>
                          </div>

                          <p className="text-xs text-slate-400 mt-1">
                            {formatDate(recoveryDate)}
                          </p>

                          <div className="mt-2 h-1.5 rounded-full bg-red-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-red-400"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (amount /
                                    DAILY_LIMIT) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>

                          <p className="text-[11px] text-slate-400 mt-2">
                            {remainingAfter > 0
                              ? `₹${remainingAfter} debt remaining after this day`
                              : "Debt fully recovered"}
                          </p>
                        </div>
                      );
                    }
                  )}

                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-emerald-600 font-bold">
                  ✓
                </div>

                <div>
                  <p className="font-semibold text-emerald-700">
                    No debt to recover
                  </p>
                  <p className="text-sm text-emerald-600 mt-1">
                    Your ₹{DAILY_LIMIT} daily budget is available normally.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =================================================
            SAVINGS CALCULATOR
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-start gap-3 mb-5">

            <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0 font-bold">
              SV
            </div>

            <div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900">
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
                onChange={(e) => {
                  const value = e.target.value;
                  setCalculatorTarget(value);
                  saveLocalUserData({ calculatorTarget: value });
                }}
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
                onChange={(e) => {
                  const value = e.target.value;
                  setCalculatorDaily(value);
                  saveLocalUserData({ calculatorDaily: value });
                }}
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
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Savings Plans
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Your finalized SV plans and their progress.
              </p>
            </div>

            <div className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold">
              {savingsPlans.length}
            </div>

          </div>

          {savingsPlans.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">

              <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 font-bold">
                SV
              </div>

              <p className="text-slate-500 text-sm font-semibold mt-3">
                No savings plans yet.
              </p>

              <p className="text-slate-300 text-xs mt-1">
                Calculate a plan and finalize it with a matching goal.
              </p>

            </div>

          ) : (

            <div className="space-y-4">

              {savingsPlans.map((plan) => {

                const linkedGoal =
                  goals.find(
                    (goal) =>
                      goal.id === plan.goalId
                  );

                const savedAmount =
                  linkedGoal
                    ? Number(
                        linkedGoal.saved || 0
                      )
                    : 0;

                const targetAmount =
                  Number(plan.target || 0);

                const progress =
                  targetAmount > 0
                    ? Math.min(
                        100,
                        (savedAmount /
                          targetAmount) *
                          100
                      )
                    : 0;

                const todayTime =
                  new Date(
                    `${todayString}T00:00:00`
                  ).getTime();

                const startTime =
                  new Date(
                    `${plan.startDate}T00:00:00`
                  ).getTime();

                const endTime =
                  new Date(
                    `${plan.endDate}T00:00:00`
                  ).getTime();

                const completed =
                  progress >= 100;

                const notStarted =
                  todayTime < startTime;

                const ended =
                  todayTime > endTime &&
                  !completed;

                const elapsedDays =
                  notStarted
                    ? 0
                    : Math.min(
                        plan.days,
                        Math.max(
                          1,
                          getDateDifference(
                            plan.startDate,
                            todayString
                          ) + 1
                        )
                      );

                const remainingDays =
                  Math.max(
                    0,
                    plan.days -
                      elapsedDays
                  );

                return (

                  <div
                    key={plan.id}
                    className="rounded-3xl border border-slate-200 overflow-hidden"
                  >

                    {/* PLAN HEADER */}

                    <div className="p-4 bg-violet-50/60">

                      <div className="flex items-start justify-between gap-3">

                        <div className="flex items-center gap-3 min-w-0">

                          <div className="w-12 h-12 shrink-0 rounded-2xl bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
                            SV
                            {plan.planNumber}
                          </div>

                          <div className="min-w-0">

                            <p className="font-bold text-slate-900 truncate">
                              SV
                              {plan.planNumber}{" "}
                              ₹{plan.daily}
                              /day
                            </p>

                            <p className="text-sm font-semibold text-blue-600 mt-1 truncate">
                              {plan.goalName}
                            </p>

                          </div>

                        </div>

                        <button
                          onClick={() =>
                            deleteSavingsPlan(
                              plan.id
                            )
                          }
                          className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                    {/* PLAN DETAILS */}

                    <div className="p-4">

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">

                        <div className="rounded-2xl bg-slate-50 p-3">

                          <p className="text-[11px] text-slate-400">
                            Target
                          </p>

                          <p className="font-bold text-slate-800 mt-1">
                            ₹{plan.target}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-blue-50 p-3">

                          <p className="text-[11px] text-blue-400">
                            Saved
                          </p>

                          <p className="font-bold text-blue-700 mt-1">
                            ₹{savedAmount}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-emerald-50 p-3">

                          <p className="text-[11px] text-emerald-500">
                            Progress
                          </p>

                          <p className="font-bold text-emerald-700 mt-1">
                            {Math.round(
                              progress
                            )}%
                          </p>

                        </div>

                        <div className="rounded-2xl bg-orange-50 p-3">

                          <p className="text-[11px] text-orange-400">
                            Days
                          </p>

                          <p className="font-bold text-orange-700 mt-1">
                            {remainingDays}
                          </p>

                        </div>

                      </div>

                      {/* PROGRESS BAR */}

                      <div className="mt-4">

                        <div className="flex items-center justify-between text-xs mb-2">

                          <span className="text-slate-400">
                            Goal progress
                          </span>

                          <span className="font-semibold text-slate-600">
                            ₹{savedAmount} / ₹
                            {targetAmount}
                          </span>

                        </div>

                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">

                          <div
                            className="h-full bg-violet-600 rounded-full transition-all"
                            style={{
                              width: `${progress}%`,
                            }}
                          />

                        </div>

                      </div>

                      {/* DATES */}

                      <div className="grid grid-cols-2 gap-3 mt-4">

                        <div>

                          <p className="text-[11px] text-slate-400">
                            Start date
                          </p>

                          <p className="text-sm font-semibold text-slate-700 mt-1">
                            {formatDate(
                              plan.startDate
                            )}
                          </p>

                        </div>

                        <div>

                          <p className="text-[11px] text-slate-400">
                            End date
                          </p>

                          <p className="text-sm font-semibold text-slate-700 mt-1">
                            {formatDate(
                              plan.endDate
                            )}
                          </p>

                        </div>

                      </div>

                      {/* STATUS */}

                      <div className="mt-4">

                        {completed ? (

                          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">

                            <p className="text-sm font-bold text-emerald-700">
                              ✓ Goal completed
                            </p>

                            <p className="text-xs text-emerald-600 mt-1">
                              You have reached ₹
                              {targetAmount}.
                            </p>

                          </div>

                        ) : notStarted ? (

                          <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">

                            <p className="text-sm font-bold text-blue-700">
                              Plan starts soon
                            </p>

                            <p className="text-xs text-blue-600 mt-1">
                              Start saving on{" "}
                              {formatDate(
                                plan.startDate
                              )}.
                            </p>

                          </div>

                        ) : ended ? (

                          <div className="rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3">

                            <p className="text-sm font-bold text-orange-700">
                              Plan period ended
                            </p>

                            <p className="text-xs text-orange-600 mt-1">
                              ₹
                              {Math.max(
                                0,
                                targetAmount -
                                  savedAmount
                              )}{" "}
                              is still remaining.
                            </p>

                          </div>

                        ) : (

                          <div className="rounded-2xl bg-violet-50 border border-violet-100 px-4 py-3">

                            <div className="flex items-center justify-between gap-3">

                              <div>

                                <p className="text-sm font-bold text-violet-700">
                                  Plan active
                                </p>

                                <p className="text-xs text-violet-600 mt-1">
                                  Save ₹
                                  {plan.daily}
                                  {" "}each day.
                                </p>

                              </div>

                              <div className="text-right">

                                <p className="text-xs text-violet-500">
                                  Remaining
                                </p>

                                <p className="font-bold text-violet-700">
                                  ₹
                                  {Math.max(
                                    0,
                                    targetAmount -
                                      savedAmount
                                  )}
                                </p>

                              </div>

                            </div>

                          </div>

                        )}

                      </div>

                    </div>

                  </div>

                );
              })}

            </div>

          )}

        </section>

        {/* =================================================
            SAVINGS GOALS
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-center justify-between gap-3 mb-5">

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Savings Goals
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Add your own goal and decide what you want to save for.
              </p>
            </div>

            <button
              onClick={() =>
                setShowGoalForm(!showGoalForm)
              }
              className="shrink-0 rounded-2xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold active:scale-95 transition"
            >
              + Add Goal
            </button>

          </div>

          {showGoalForm && (
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4 sm:p-5 mb-5">

              <p className="font-semibold text-slate-800 mb-3">
                Create a new goal
              </p>

              <div className="space-y-3">

                <input
                  type="text"
                  placeholder="Goal name"
                  value={goalNameInput}
                  onChange={(e) =>
                    setGoalNameInput(e.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:ring-2 focus:ring-slate-200"
                />

                <input
                  type="number"
                  min="1"
                  placeholder="How much do you need?"
                  value={goalTargetInput}
                  onChange={(e) =>
                    setGoalTargetInput(e.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:ring-2 focus:ring-slate-200"
                />

                <input
                  type="date"
                  min={addDays(todayString, 1)}
                  value={goalDateInput}
                  onChange={(e) =>
                    setGoalDateInput(e.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:ring-2 focus:ring-slate-200"
                />

                <div className="flex flex-col sm:flex-row gap-3">

                  <button
                    onClick={createGoal}
                    className="flex-1 rounded-2xl bg-slate-900 text-white py-3.5 font-semibold active:scale-[0.98] transition"
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
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-600"
                  >
                    Cancel
                  </button>

                </div>

              </div>

            </div>
          )}

          {goals.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center">

              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 text-xl">
                ₹
              </div>

              <p className="text-slate-600 text-sm font-semibold mt-3">
                No savings goals yet.
              </p>

              <p className="text-slate-400 text-xs mt-1">
                Add your first goal using the button above.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {goals.map((goal) => {

                const target =
                  Number(goal.target || 0);

                const saved =
                  Number(goal.saved || 0);

                const remaining =
                  Math.max(
                    0,
                    target - saved
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
                    ? remaining / daysLeft
                    : remaining;

                const progress =
                  target > 0
                    ? Math.min(
                        100,
                        (saved / target) * 100
                      )
                    : 0;

                const completed =
                  remaining <= 0;

                const connectedPlan =
                  savingsPlans.find(
                    (plan) =>
                      plan.goalId === goal.id
                  );

                return (

                  <div
                    key={goal.id}
                    className="rounded-3xl border border-slate-200 overflow-hidden"
                  >

                    {/* GOAL HEADER */}

                    <div className="p-4 bg-blue-50/60">

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                            {goal.name}
                          </p>

                          <p className="text-sm text-slate-500 mt-1">
                            ₹{saved} saved of ₹{target}
                          </p>

                        </div>

                        <button
                          onClick={() =>
                            deleteGoal(goal.id)
                          }
                          className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                    <div className="p-4">

                      {/* PROGRESS */}

                      <div>

                        <div className="flex justify-between items-center text-xs mb-2">

                          <span className="text-slate-400">
                            Progress
                          </span>

                          <span className="font-bold text-blue-600">
                            {Math.round(progress)}%
                          </span>

                        </div>

                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">

                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{
                              width: `${progress}%`,
                            }}
                          />

                        </div>

                      </div>

                      {/* GOAL DETAILS */}

                      <div className="grid grid-cols-2 gap-2 mt-4">

                        <div className="rounded-2xl bg-slate-50 p-3">

                          <p className="text-[11px] text-slate-400">
                            Remaining
                          </p>

                          <p className="font-bold text-slate-800 mt-1">
                            ₹{remaining}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-slate-50 p-3">

                          <p className="text-[11px] text-slate-400">
                            Days left
                          </p>

                          <p className="font-bold text-slate-800 mt-1">
                            {daysLeft}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-slate-50 p-3">

                          <p className="text-[11px] text-slate-400">
                            Daily needed
                          </p>

                          <p className="font-bold text-slate-800 mt-1">
                            ₹{dailyNeeded.toFixed(2)}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-slate-50 p-3">

                          <p className="text-[11px] text-slate-400">
                            Target date
                          </p>

                          <p className="font-bold text-slate-800 text-xs mt-2">
                            {formatDate(
                              goal.targetDate
                            )}
                          </p>

                        </div>

                      </div>

                      {/* CONNECTED PLAN */}

                      {connectedPlan && (

                        <div className="mt-4 rounded-2xl bg-violet-50 border border-violet-100 p-3">

                          <div className="flex items-center justify-between gap-2">

                            <div>

                              <p className="text-[11px] text-violet-400">
                                Connected plan
                              </p>

                              <p className="font-bold text-violet-700 mt-1">
                                SV
                                {connectedPlan.planNumber}
                                {" "}₹
                                {connectedPlan.daily}
                                /day
                              </p>

                            </div>

                            <span className="text-[10px] font-semibold text-violet-500">
                              Active
                            </span>

                          </div>

                        </div>

                      )}

                      {/* STATUS */}

                      {completed ? (

                        <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">

                          <p className="text-sm font-bold text-emerald-700">
                            ✓ Goal completed
                          </p>

                        </div>

                      ) : (

                        <div className="mt-4 rounded-2xl bg-slate-50 p-3">

                          <p className="text-xs text-slate-400">
                            Save approximately
                          </p>

                          <p className="text-sm font-bold text-slate-700 mt-1">
                            ₹{dailyNeeded.toFixed(2)}
                            {" "}per day
                          </p>

                        </div>

                      )}

                      {/* ADD MONEY */}

                      <button
                        onClick={() => {
                          const value =
                            prompt(
                              `How much do you want to save for ${goal.name}?`
                            );

                          if (value === null) {
                            return;
                          }

                          addMoneyToGoal(
                            goal.id,
                            Number(value)
                          );
                        }}
                        className="w-full mt-4 rounded-2xl bg-slate-900 text-white py-3.5 font-semibold active:scale-[0.98] transition"
                      >
                        Add Money
                      </button>

                    </div>

                  </div>

                );
              })}

            </div>

          )}

        </section>

        {/* =================================================
            HISTORY
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm mt-5">

          <div className="flex items-start justify-between gap-3 mb-5">

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                History
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                All your expenses, savings, and debt recovery.
              </p>
            </div>

            <div className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-right">

              <p className="text-[10px] text-slate-400">
                Total Expenses
              </p>

              <p className="text-sm font-bold text-slate-700">
                ₹{totalExpenses}
              </p>

            </div>

          </div>

          {history.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center">

              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-xl">
                ↕
              </div>

              <p className="text-sm text-slate-500 font-semibold mt-3">
                No transactions yet.
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Your activity will appear here.
              </p>

            </div>

          ) : (

            <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2">

              {[...history]
                .reverse()
                .map((item) => {

                  const isSaving =
                    item.type === "saving";

                  const isRecovery =
                    item.type === "recovery";

                  const title =
                    isSaving
                      ? "Actual Saving"
                      : isRecovery
                      ? "Debt Recovery"
                      : "Expense";

                  const amountText =
                    isSaving
                      ? `+₹${item.amount}`
                      : isRecovery
                      ? `₹${item.amount} recovered`
                      : `-₹${item.amount}`;

                  const amountClass =
                    isSaving
                      ? "text-blue-600"
                      : isRecovery
                      ? "text-orange-500"
                      : "text-red-500";

                  const icon =
                    isSaving
                      ? "S"
                      : isRecovery
                      ? "R"
                      : "E";

                  const iconClass =
                    isSaving
                      ? "bg-blue-50 text-blue-600"
                      : isRecovery
                      ? "bg-orange-50 text-orange-600"
                      : "bg-red-50 text-red-600";

                  return (

                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4"
                    >

                      <div className="flex items-center justify-between gap-3">

                        <div className="flex items-center gap-3 min-w-0">

                          <div
                            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${iconClass}`}
                          >
                            {icon}
                          </div>

                          <div className="min-w-0">

                            <p className="font-semibold text-sm text-slate-800 truncate">
                              {title}
                            </p>

                            <p className="text-xs text-slate-400 mt-1">
                              {formatDate(item.date)}
                            </p>

                          </div>

                        </div>

                        <div className="flex items-center gap-2 shrink-0">

                          <p
                            className={`font-bold text-sm sm:text-base ${amountClass}`}
                          >
                            {amountText}
                          </p>

                          {!isSaving && !isRecovery && (
                            <button
                              onClick={() => editExpense(item.id)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          )}

                        </div>

                      </div>

                      {/* EXTRA EXPENSE INFORMATION */}

                      {!isSaving &&
                        !isRecovery &&
                        Number(item.debtAfter || 0) > 0 && (

                          <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2">

                            <div className="flex items-center justify-between gap-2">

                              <span className="text-[11px] text-red-500">
                                Debt after expense
                              </span>

                              <span className="text-xs font-bold text-red-600">
                                ₹{item.debtAfter}
                              </span>

                            </div>

                          </div>

                        )}

                      {/* RECOVERY INFORMATION */}

                      {isRecovery && (

                        <div className="mt-3 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2">

                          <div className="flex items-center justify-between gap-2">

                            <span className="text-[11px] text-orange-500">
                              Remaining debt
                            </span>

                            <span className="text-xs font-bold text-orange-600">
                              ₹{item.debtAfter || 0}
                            </span>

                          </div>

                        </div>

                      )}

                    </div>

                  );
                })}

            </div>

          )}

        </section>

        {/* =================================================
            RESET
        ================================================= */}

        <section className="mt-6 mb-4 rounded-3xl border border-red-100 bg-white p-5 sm:p-6 shadow-sm">

          <div className="flex items-start gap-3">

            <div className="w-10 h-10 shrink-0 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-bold">
              !
            </div>

            <div className="flex-1">

              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Reset Everything
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Permanently delete all budget data, goals, plans, expenses, savings, debt, and history.
              </p>

              <button
                onClick={resetEverything}
                className="w-full mt-4 rounded-2xl bg-red-600 text-white py-3.5 font-semibold hover:bg-red-700 active:scale-[0.98] transition"
              >
                Reset Everything
              </button>

            </div>

          </div>

        </section>

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

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 md:hidden z-50 pb-[env(safe-area-inset-bottom)]">

        <div className="grid grid-cols-4 py-1.5">

          <button className="flex flex-col items-center gap-0.5 text-slate-700 py-1 active:scale-95 transition">

            <span className="text-base leading-none">
              ⌂
            </span>

            <span className="text-[9px] font-semibold">
              Home
            </span>

          </button>

          <button className="flex flex-col items-center gap-0.5 text-slate-500 py-1 active:scale-95 transition">

            <span className="text-base leading-none">
              +
            </span>

            <span className="text-[9px] font-semibold">
              Save
            </span>

          </button>

          <button className="flex flex-col items-center gap-0.5 text-slate-500 py-1 active:scale-95 transition">

            <span className="text-base leading-none">
              □
            </span>

            <span className="text-[9px] font-semibold">
              Calendar
            </span>

          </button>

          <button className="flex flex-col items-center gap-0.5 text-slate-500 py-1 active:scale-95 transition">

            <span className="text-base leading-none">
              ≡
            </span>

            <span className="text-[9px] font-semibold">
              History
            </span>

          </button>

        </div>

      </nav>

    </div>
  );
}

export default App;
