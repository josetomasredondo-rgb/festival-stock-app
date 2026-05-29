import { createContext, useContext, useState } from "react";

const RoleContext = createContext(null);

export const ROLE_ACCESS = {
  bar_leader: ["Dashboard", "SubmitReport", "DailySheet"],
  event_coordinator: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup"],
  manager: ["Dashboard", "SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup", "Financials"],
};

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => sessionStorage.getItem("app_role") || null);

  const selectRole = (r) => {
    sessionStorage.setItem("app_role", r);
    setRole(r);
  };

  const clearRole = () => {
    sessionStorage.removeItem("app_role");
    setRole(null);
  };

  return (
    <RoleContext.Provider value={{ role, selectRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
