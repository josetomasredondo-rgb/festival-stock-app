import { useRole } from "./lib/RoleContext";
import { LogOut } from "lucide-react";

const ROLE_LABELS = {
  bar_leader: "Responsável de Bar",
  event_coordinator: "Coordenador de Evento",
  manager: "Gestor da Empresa",
};

export default function Layout({ children }) {
  const { role, clearRole } = useRole();
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {role && (
        <div className="fixed top-3 right-3 z-50">
          <button onClick={clearRole}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 shadow-sm transition-all">
            <LogOut className="w-3.5 h-3.5" />
            {ROLE_LABELS[role] || role}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
