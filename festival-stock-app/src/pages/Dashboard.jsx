import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart2, ClipboardList, Package, ArrowRight, Lock, FileText, DollarSign } from "lucide-react";
import db from "../lib/db";
import { useRole } from "../lib/RoleContext";

const ROLE_ACCESS = {
  bar_leader: ["SubmitReport", "DailySheet"],
  event_coordinator: ["SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup"],
  manager: ["SubmitReport", "DailySheet", "Reports", "FestivalReport", "Setup", "Financials"],
};

export default function Dashboard() {
  const { role } = useRole();
  const [bars, setBars] = useState([]);
  const [reports, setReports] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showNewFestivalConfirm, setShowNewFestivalConfirm] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    Promise.all([
      db.Bar.list(),
      db.StockReport.list("-created_date", 20),
      db.FestivalSettings.list()
    ]).then(([b, r, s]) => {
      setBars(b);
      setReports(r);
      setSettings(s[0] || null);
      setLoading(false);
    });
  }, []);

  const isClosed = settings?.is_closed === true;
  const allowed = ROLE_ACCESS[role] || [];

  const handleCloseFestival = async () => {
    setWorking(true);
    if (settings) {
      await db.FestivalSettings.update(settings.id, { is_closed: true, closed_at: new Date().toISOString() });
    } else {
      await db.FestivalSettings.create({ is_closed: true, closed_at: new Date().toISOString() });
    }
    const s = await db.FestivalSettings.list();
    setSettings(s[0] || null);
    setWorking(false);
    setShowCloseConfirm(false);
  };

  const handleReopenFestival = async () => {
    if (!settings) return;
    await db.FestivalSettings.update(settings.id, { is_closed: false, closed_at: null });
    const s = await db.FestivalSettings.list();
    setSettings(s[0] || null);
  };

  const handleNewFestival = async () => {
    setWorking(true);
    const allReports = await db.StockReport.list("-created_date", 500);
    await Promise.all(allReports.map(r => db.StockReport.delete(r.id)));
    if (settings) {
      await db.FestivalSettings.update(settings.id, { is_closed: false, closed_at: null });
    }
    const [b, r, s] = await Promise.all([db.Bar.list(), db.StockReport.list("-created_date", 20), db.FestivalSettings.list()]);
    setBars(b); setReports(r); setSettings(s[0] || null);
    setWorking(false);
    setShowNewFestivalConfirm(false);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayReports = reports.filter(r => r.report_date === today);

  const allCards = [
    { key: "SubmitReport", title: "Relatório de Contagens", description: "Contagem de abertura, entrega ou fecho de um bar", icon: ClipboardList, color: "from-violet-500 to-purple-600", light: "bg-violet-50 text-violet-700" },
    { key: "DailySheet", title: "Folha Diária", description: "Ver todos os dados de stock dos bares para qualquer dia", icon: BarChart2, color: "from-teal-500 to-cyan-600", light: "bg-teal-50 text-teal-700" },
    { key: "Setup", title: "Gerir Bares e Produtos", description: "Configurar bares, responsáveis e catálogo de produtos", icon: Package, color: "from-orange-500 to-amber-500", light: "bg-orange-50 text-orange-700" },
    { key: "FestivalReport", title: "Relatório Final", description: "Ver o resumo completo do festival em todos os bares e dias", icon: FileText, color: "from-slate-600 to-slate-800", light: "bg-slate-100 text-slate-700" },
    { key: "Reports", title: "Ver e Editar Relatórios", description: "Ver, filtrar e editar qualquer relatório de stock submetido", icon: ClipboardList, color: "from-rose-500 to-pink-600", light: "bg-rose-50 text-rose-700" },
    { key: "Financials", title: "Financeiros", description: "Estimativas de receita, preços de produtos e controlo de desperdício/oferta", icon: DollarSign, color: "from-emerald-500 to-green-600", light: "bg-emerald-50 text-emerald-700" },
  ];

  const cards = allCards.filter(c => allowed.includes(c.key));

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Festival Stock</h1>
            <p className="text-neutral-400 mt-1">{new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          {role === "manager" && (
            <div className="flex gap-2">
              {isClosed ? (
                <>
                  <button onClick={handleReopenFestival} className="px-4 py-2 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">Reabrir Festival</button>
                  <button onClick={() => setShowNewFestivalConfirm(true)} className="px-4 py-2 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">Novo Festival</button>
                </>
              ) : (
                <button onClick={() => setShowCloseConfirm(true)} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                  <Lock className="w-4 h-4" /> Fechar Festival
                </button>
              )}
            </div>
          )}
        </div>

        {isClosed && (
          <div className="mb-6 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" /> Festival fechado — não é possível submeter novos relatórios
          </div>
        )}

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="text-3xl font-bold text-neutral-900">{bars.filter(b => b.is_active !== false).length}</div>
              <div className="text-sm text-neutral-400 mt-1">Bares Ativos</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="text-3xl font-bold text-neutral-900">{todayReports.length}</div>
              <div className="text-sm text-neutral-400 mt-1">Relatórios Hoje</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="text-3xl font-bold text-neutral-900">{reports.length}</div>
              <div className="text-sm text-neutral-400 mt-1">Total Relatórios</div>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.key} to={`/${card.key}`} className="bg-white rounded-2xl border border-neutral-100 p-6 hover:shadow-md hover:border-neutral-200 transition-all group">
                <div className={`h-1 w-full rounded-full bg-gradient-to-r ${card.color} mb-5`} />
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${card.light} mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-neutral-900 mb-1">{card.title}</h3>
                <p className="text-sm text-neutral-400 mb-4">{card.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 group-hover:text-neutral-900 transition-colors">
                  Abrir <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Recent Reports */}
        {reports.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Relatórios Recentes</h2>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              {reports.slice(0, 5).map((r, i) => {
                const typeColors = { opening: "bg-blue-100 text-blue-700", delivery: "bg-amber-100 text-amber-700", night_delivery: "bg-indigo-100 text-indigo-700", closing: "bg-emerald-100 text-emerald-700" };
                const typeLabels = { opening: "Abertura", delivery: "Entrega", night_delivery: "Entrega Noturna", closing: "Fecho" };
                return (
                  <div key={r.id} className={`flex items-center gap-4 px-6 py-4 ${i < reports.slice(0,5).length - 1 ? "border-b border-neutral-50" : ""}`}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeColors[r.report_type] || "bg-neutral-100 text-neutral-600"}`}>
                      {typeLabels[r.report_type] || r.report_type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-neutral-900 truncate">{r.bar_name}</div>
                      <div className="text-xs text-neutral-400">{r.festival_day} · {r.report_date}{r.submitted_by ? ` · por ${r.submitted_by}` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Close Festival Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-neutral-900 mb-2">Fechar o Festival?</h3>
            <p className="text-sm text-neutral-500 mb-5">Nenhum novo relatório poderá ser submetido após fechar.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">Cancelar</button>
              <button onClick={handleCloseFestival} disabled={working} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {working ? "A fechar..." : "Fechar Festival"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Festival Confirm Modal */}
      {showNewFestivalConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-neutral-900 mb-2">Iniciar Novo Festival?</h3>
            <p className="text-sm text-neutral-500 mb-5">⚠️ Todos os relatórios de stock serão eliminados permanentemente. Os bares e produtos serão mantidos.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowNewFestivalConfirm(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">Cancelar</button>
              <button onClick={handleNewFestival} disabled={working} className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50">
                {working ? "A reiniciar..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
