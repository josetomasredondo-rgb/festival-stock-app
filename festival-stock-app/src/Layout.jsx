import { useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { useAuth, ROLE_LABELS } from "./lib/AuthContext";

export default function Layout({ children }) {
  const { user, role, currentFestival, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {user && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-100 shadow-sm px-4 h-12 flex items-center justify-between">
          {/* Left: festival name */}
          <div className="flex items-center gap-2 min-w-0">
            {currentFestival ? (
              <span className="font-semibold text-sm text-neutral-900 truncate max-w-[200px]">
                {currentFestival.name}
              </span>
            ) : (
              <span className="text-sm text-neutral-400">Sem festival</span>
            )}
            <button
              onClick={() => navigate("/FestivalSelect")}
              className="text-xs text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-lg px-2 py-0.5 hover:border-neutral-400 transition-all shrink-0">
              Trocar
            </button>
          </div>

          {/* Right: settings icon (manager) + user/logout */}
          <div className="flex items-center gap-2 shrink-0">
            {role === "manager" && (
              <button onClick={() => navigate("/GlobalSettings")}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                title="Definições Globais">
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-all">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{user.name} · {ROLE_LABELS[role] || role}</span>
            </button>
          </div>
        </div>
      )}
      {/* Push content below the fixed top bar */}
      <div className={user ? "pt-12" : ""}>
        {children}
      </div>
    </div>
  );
}
