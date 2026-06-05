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
  manager: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup", "Financials"],
};

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
