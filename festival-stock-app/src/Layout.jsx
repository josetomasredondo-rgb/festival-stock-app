import { useNavigate } from "react-router-dom";
import { LogOut, Flag } from "lucide-react";
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
        <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
          {currentFestival && (
            <button
              onClick={() => navigate("/FestivalSelect")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 shadow-sm transition-all"
            >
              <Flag className="w-3.5 h-3.5" />
              {currentFestival.name}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 shadow-sm transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            {user.name} · {ROLE_LABELS[role] || role}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
