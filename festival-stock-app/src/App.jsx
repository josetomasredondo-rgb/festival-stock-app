import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ROLE_ACCESS } from "./lib/AuthContext";
import Layout from "./Layout";
import RoleSelect from "./pages/RoleSelect";
import FestivalSelect from "./pages/FestivalSelect";
import Dashboard from "./pages/Dashboard";
import SubmitReport from "./pages/SubmitReport";
import DailySheet from "./pages/DailySheet";
import Reports from "./pages/Reports";
import FestivalReport from "./pages/FestivalReport";
import Setup from "./pages/Setup";

const ALL_PAGES = {
  Dashboard, SubmitReport, DailySheet, Reports, FestivalReport, Setup
};

function AppRoutes() {
  const { user, role, currentFestival } = useAuth();

  if (!user) return <RoleSelect />;

  // Logged in but no festival selected yet — send to festival select
  if (!currentFestival && role !== "manager") return <FestivalSelect />;

  const allowed = ROLE_ACCESS[role] || [];

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/Dashboard" replace />} />
        <Route path="/FestivalSelect" element={<FestivalSelect />} />
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
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
