import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Flag } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import db from "../lib/db";

export default function FestivalSelect() {
  const { user, role, currentFestival, setCurrentFestival } = useAuth();
  const navigate = useNavigate();

  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ativos");
  const [creating, setCreating] = useState(false);
  const [newFestival, setNewFestival] = useState({ name: "", start_date: "", end_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.Festival.list().then(f => { setFestivals(f); setLoading(false); });
  }, []);

  const myIds = user?.festival_ids || [];

  const visible = festivals.filter(f => {
    if (role === "manager") return true;
    return myIds.includes(f.id);
  });

  const active = visible.filter(f => f.is_active && !f.is_closed);
  const closed = visible.filter(f => !f.is_active || f.is_closed);

  // bar_leader and night_delivery only see active
  const showClosed = role === "event_coordinator" || role === "manager";

  const handleSelect = (festival) => {
    setCurrentFestival(festival);
    navigate("/Dashboard");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newFestival.name.trim()) return;
    setSaving(true);
    const created = await db.Festival.create({ ...newFestival, is_active: true, is_closed: false });
    setCurrentFestival(created);
    navigate("/Dashboard");
  };

  const handleClose = async (id) => {
    if (!window.confirm("Fechar este festival? Os relatórios ainda podem ser consultados.")) return;
    await db.Festival.update(id, { is_closed: true, is_active: false });
    setFestivals(prev => prev.map(f => f.id === id ? { ...f, is_closed: true, is_active: false } : f));
  };

  const handleReopen = async (id) => {
    await db.Festival.update(id, { is_closed: false, is_active: true });
    setFestivals(prev => prev.map(f => f.id === id ? { ...f, is_closed: false, is_active: true } : f));
  };

  const displayList = tab === "ativos" ? active : closed;

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-2xl mb-4">
            <Flag className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Selecionar Festival</h1>
          <p className="text-neutral-400 mt-1 text-sm">
            {currentFestival ? `Festival atual: ${currentFestival.name}` : "Escolhe em qual festival trabalhar"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {["ativos", ...(showClosed ? ["fechados"] : [])].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all capitalize ${tab === t ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {t === "ativos" ? "Festivais Ativos" : "Festivais Fechados"}
            </button>
          ))}
        </div>

        {/* Festival list */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <div className="space-y-2 mb-6">
            {displayList.map(f => (
              <div key={f.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${currentFestival?.id === f.id ? "border-neutral-900 ring-2 ring-neutral-200" : "border-neutral-100"}`}>
                <button
                  onClick={() => handleSelect(f)}
                  className="w-full text-left px-5 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-neutral-900">{f.name}</div>
                      {f.start_date && (
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {f.start_date}{f.end_date ? ` → ${f.end_date}` : ""}
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
                {role === "manager" && (
                  <div className="px-5 pb-3 flex gap-2 border-t border-neutral-50 pt-2">
                    {f.is_closed ? (
                      <button onClick={() => handleReopen(f.id)} className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Reabrir</button>
                    ) : (
                      <button onClick={() => handleClose(f.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Fechar Festival</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {displayList.length === 0 && (
              <div className="bg-white rounded-2xl border border-neutral-100 py-10 text-center text-sm text-neutral-300 shadow-sm">
                {tab === "ativos" ? "Sem festivais ativos" : "Sem festivais fechados"}
              </div>
            )}
          </div>
        )}

        {/* Manager: create new festival */}
        {role === "manager" && tab === "ativos" && (
          <>
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all"
              >
                <Plus className="w-4 h-4" /> Criar Novo Festival
              </button>
            ) : (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Novo Festival</div>
                <form onSubmit={handleCreate} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome do festival *"
                    value={newFestival.name}
                    onChange={e => setNewFestival(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Data início</label>
                      <input type="date" value={newFestival.start_date}
                        onChange={e => setNewFestival(f => ({ ...f, start_date: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Data fim</label>
                      <input type="date" value={newFestival.end_date}
                        onChange={e => setNewFestival(f => ({ ...f, end_date: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setCreating(false)}
                      className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                      Cancelar
                    </button>
                    <button type="submit" disabled={saving || !newFestival.name.trim()}
                      className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Criar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
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
