import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ROLE_ACCESS } from "./lib/AuthContext";
import Layout from "./Layout";
import RoleSelect from "./pages/RoleSelect";
import FestivalSelect from "./pages/FestivalSelect";
import GlobalSettings from "./pages/GlobalSettings";
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

  // GlobalSettings is accessible to manager regardless of festival context
  // (rendered inside Layout so the top bar still shows)
  return (
    <Layout>
      <Routes>
        {/* Festival-independent routes */}
        <Route path="/FestivalSelect" element={<FestivalSelect />} />
        {role === "manager" && <Route path="/GlobalSettings" element={<GlobalSettings />} />}

        {/* Redirect to festival select if no festival chosen (non-manager) */}
        {!currentFestival && role !== "manager" ? (
          <Route path="*" element={<FestivalSelect />} />
        ) : (
          <>
            <Route path="/" element={<Navigate to="/Dashboard" replace />} />
            <Route path="/Dashboard" element={<Dashboard />} />
            {(ROLE_ACCESS[role] || []).filter(p => p !== "Dashboard").map(pageName => {
              const Page = ALL_PAGES[pageName];
              return Page ? <Route key={pageName} path={`/${pageName}`} element={<Page />} /> : null;
            })}
            <Route path="*" element={<Navigate to="/Dashboard" replace />} />
          </>
        )}
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
