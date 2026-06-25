import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./db";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  bar_leader: "Chefe de Bar",
  night_delivery: "Reposição",
  event_coordinator: "Coordenador de Evento",
  manager: "Gestor da Empresa",
};

export const ROLE_ACCESS = {
  bar_leader: ["Dashboard", "SubmitReport", "DailySheet"],
  night_delivery: ["Dashboard", "SubmitReport", "DailySheet", "Movimentos"],
  event_coordinator: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup", "Warehouse", "Movimentos"],
  manager: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup", "Warehouse", "Movimentos"],
};

export const DEFAULT_SETTINGS = {
  num_days: 5,
  day_names: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
  report_type_labels: {
    opening: "Contagem Inicial",
    delivery: "Reposição (Dia)",
    night_delivery: "Reposição (Noite)",
    closing: "Contagem Final",
  },
};

export function useFestivalSettings() {
  const { currentFestival } = useContext(AuthContext);
  const numDays = currentFestival?.num_days || DEFAULT_SETTINGS.num_days;
  const rawDayNames = currentFestival?.day_names || [];
  const dayNames = Array.from({ length: numDays }, (_, i) =>
    rawDayNames[i] || DEFAULT_SETTINGS.day_names[i] || `Dia ${i + 1}`
  );
  const s = currentFestival?.settings || {};
  const reportTypeLabels = {
    opening: s.report_type_labels?.opening || DEFAULT_SETTINGS.report_type_labels.opening,
    delivery: s.report_type_labels?.delivery || DEFAULT_SETTINGS.report_type_labels.delivery,
    night_delivery: s.report_type_labels?.night_delivery || DEFAULT_SETTINGS.report_type_labels.night_delivery,
    closing: s.report_type_labels?.closing || DEFAULT_SETTINGS.report_type_labels.closing,
  };
  return { numDays, dayNames, reportTypeLabels };
}

function readSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user] = useState(() => readSession("app_user"));
  const [currentFestival, setCurrentFestivalRaw] = useState(() => readSession("app_festival"));
  // Block rendering until we have fresh festival data from DB
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cached = readSession("app_festival");
    if (!cached?.id) {
      setReady(true);
      return;
    }
    // Always fetch latest festival from Supabase so day_names / bar_ids etc.
    // are never stale from a previous session
    supabase.from("festivals").select("*").eq("id", cached.id).single()
      .then(({ data }) => {
        if (data) {
          sessionStorage.setItem("app_festival", JSON.stringify(data));
          setCurrentFestivalRaw(data);
        }
        setReady(true);
      })
      .catch(() => setReady(true)); // on network error, proceed with cached data
  }, []);

  const [userState, setUserState] = useState(user);

  const login = (u) => {
    sessionStorage.setItem("app_user", JSON.stringify(u));
    setUserState(u);
  };

  const logout = () => {
    sessionStorage.removeItem("app_user");
    sessionStorage.removeItem("app_festival");
    setUserState(null);
    setCurrentFestivalRaw(null);
  };

  const setCurrentFestival = (f) => {
    sessionStorage.setItem("app_festival", JSON.stringify(f));
    setCurrentFestivalRaw(f);
  };

  const role = userState?.role || null;

  // Don't render anything until the festival refresh is complete —
  // prevents SubmitReport from using stale day_names before the fetch lands
  if (!ready) return null;

  return (
    <AuthContext.Provider value={{ user: userState, role, currentFestival, setCurrentFestival, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
