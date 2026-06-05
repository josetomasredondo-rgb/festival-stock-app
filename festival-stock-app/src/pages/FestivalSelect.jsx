import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Flag, Settings } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import db from "../lib/db";

export default function FestivalSelect() {
  const { user, role, currentFestival, setCurrentFestival } = useAuth();
  const navigate = useNavigate();

  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ativos");

  useEffect(() => {
    db.Festival.list().then(f => { setFestivals(f); setLoading(false); });
  }, []);

  // Filter festivals visible to this user:
  // - manager: all festivals
  // - others: only festivals whose user_ids contains this user's id
  const visible = festivals.filter(f => {
    if (role === "manager") return true;
    return (f.user_ids || []).includes(user?.id);
  });

  const active = visible.filter(f => f.is_active && !f.is_closed);
  const closed = visible.filter(f => !f.is_active || f.is_closed);

  const showClosed = role === "event_coordinator" || role === "manager";
  const displayList = tab === "ativos" ? active : closed;

  const handleSelect = (festival) => {
    setCurrentFestival(festival);
    navigate("/Dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        {/* Header row */}
        <div className="flex items-start justify-between mb-8">
          <div className="text-center flex-1">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-2xl mb-4">
              <Flag className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">Selecionar Festival</h1>
            <p className="text-neutral-400 mt-1 text-sm">
              {currentFestival ? `Festival atual: ${currentFestival.name}` : "Escolhe em qual festival trabalhar"}
            </p>
          </div>
          {role === "manager" && (
            <button onClick={() => navigate("/GlobalSettings")}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 shadow-sm transition-all shrink-0">
              <Settings className="w-3.5 h-3.5" />
              Definições Globais
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {["ativos", ...(showClosed ? ["fechados"] : [])].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {t === "ativos" ? "Festivais Ativos" : "Festivais Fechados"}
            </button>
          ))}
        </div>

        {/* Festival list */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <div className="space-y-2 mb-4">
            {displayList.map(f => (
              <button key={f.id} onClick={() => handleSelect(f)}
                className={`w-full text-left bg-white rounded-2xl border shadow-sm px-5 py-4 hover:bg-neutral-50 transition-colors ${currentFestival?.id === f.id ? "border-neutral-900 ring-2 ring-neutral-200" : "border-neutral-100"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-neutral-900">{f.name}</div>
                    {f.start_date && (
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {f.start_date}{f.end_date ? ` → ${f.end_date}` : ""}
                        {f.num_days ? ` · ${f.num_days} dia${f.num_days !== 1 ? "s" : ""}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {f.is_closed && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Fechado</span>}
                    {!f.is_closed && f.is_active && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Ativo</span>}
                    {currentFestival?.id === f.id && <span className="text-xs px-2 py-0.5 bg-neutral-900 text-white rounded-full">Atual</span>}
                  </div>
                </div>
              </button>
            ))}
            {displayList.length === 0 && (
              <div className="bg-white rounded-2xl border border-neutral-100 py-10 text-center text-sm text-neutral-300 shadow-sm">
                {tab === "ativos" ? "Sem festivais ativos" : "Sem festivais fechados"}
                {role !== "manager" && tab === "ativos" && (
                  <div className="mt-2 text-xs">Pede ao gestor para te atribuir a um festival</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manager: link to GlobalSettings to create festivals */}
        {role === "manager" && (
          <button onClick={() => navigate("/GlobalSettings")}
            className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all flex items-center justify-center gap-2">
            <Settings className="w-4 h-4" /> Gerir festivais em Definições Globais
          </button>
        )}

        {currentFestival && (
          <button onClick={() => navigate("/Dashboard")}
            className="w-full mt-3 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
            Continuar com {currentFestival.name}
          </button>
        )}
      </div>
    </div>
  );
}
