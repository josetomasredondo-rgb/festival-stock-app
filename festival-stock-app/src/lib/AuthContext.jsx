import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  bar_leader: "Responsável de Bar",
  night_delivery: "Entrega Noturna",
  event_coordinator: "Coordenador de Evento",
  manager: "Gestor da Empresa",
};

export const ROLE_ACCESS = {
  bar_leader: ["Dashboard", "SubmitReport", "DailySheet"],
  night_delivery: ["Dashboard", "SubmitReport", "DailySheet"],
  event_coordinator: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup"],
  manager: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup"],
};

export const DEFAULT_SETTINGS = {
  num_days: 5,
  day_names: ["Dia 1", "Dia 2", "Dia 3", "Dia 4", "Dia 5"],
  report_type_labels: {
    opening: "Contagem de Abertura",
    delivery: "Entrega Recebida",
    night_delivery: "Entrega Noturna",
    closing: "Contagem de Fecho",
  },
};

export function useFestivalSettings() {
  const { currentFestival } = useContext(AuthContext);
  const s = currentFestival?.settings || {};
  const numDays = s.num_days || DEFAULT_SETTINGS.num_days;
  const dayNames = Array.from({ length: numDays }, (_, i) =>
    s.day_names?.[i] || DEFAULT_SETTINGS.day_names[i] || `Dia ${i + 1}`
  );
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
  const [user, setUser] = useState(() => readSession("app_user"));
  const [currentFestival, setCurrentFestivalRaw] = useState(() => readSession("app_festival"));

  const role = user?.role || null;

  const login = (u) => {
    sessionStorage.setItem("app_user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    sessionStorage.removeItem("app_user");
    sessionStorage.removeItem("app_festival");
    setUser(null);
    setCurrentFestivalRaw(null);
  };

  const setCurrentFestival = (f) => {
    sessionStorage.setItem("app_festival", JSON.stringify(f));
    setCurrentFestivalRaw(f);
  };

  return (
    <AuthContext.Provider value={{ user, role, currentFestival, setCurrentFestival, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
