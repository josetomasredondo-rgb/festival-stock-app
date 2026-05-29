import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider, useRole, ROLE_ACCESS } from "./lib/RoleContext";
import Layout from "./Layout";
import RoleSelect from "./pages/RoleSelect";
import Dashboard from "./pages/Dashboard";
import SubmitReport from "./pages/SubmitReport";
import DailySheet from "./pages/DailySheet";
import Reports from "./pages/Reports";
import FestivalReport from "./pages/FestivalReport";
import Setup from "./pages/Setup";
import Financials from "./pages/Financials";

const ALL_PAGES = {
  Dashboard, SubmitReport, DailySheet, Reports, FestivalReport, Setup, Financials
};

function AppRoutes() {
  const { role, selectRole } = useRole();

  if (!role) return <RoleSelect onRoleSelected={selectRole} />;

  const allowed = ROLE_ACCESS[role] || [];

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/Dashboard" replace />} />
        <Route path="/Dashboard" element={<Dashboard />} />
        {allowed.filter(p => p !== "Dashboard").map(pageName => {
          const Page = ALL_PAGES[pageName];
          return Page ? <Route key={pageName} path={`/${pageName}`} element={<Page />} /> : null;
        })}
        <Route path="*" element={<Navigate to="/Dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <Router>
        <AppRoutes />
      </Router>
    </RoleProvider>
  );
}
