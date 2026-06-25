import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart2, ClipboardList, Package, ArrowRight, Lock, Warehouse, Pencil } from "lucide-react";
import db, { getFestivalBars } from "../lib/db";
import { useAuth, ROLE_ACCESS, useFestivalSettings } from "../lib/AuthContext";

export default function Dashboard() {
  const { role, currentFestival } = useAuth();
  const { reportTypeLabels } = useFestivalSettings();
  const navigate = useNavigate();
  const [bars, setBars] = useState([]);
  const [reports, setReports] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const festivalId = currentFestival?.id;
  const isClosed = currentFestival?.is_closed === true;

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      getFestivalBars(currentFestival),
      db.StockReport.filterByFestival(festivalId, "-created_date"),
      db.Movement.filterByFestival(festivalId, "-created_date"),
    ]).then(([b, r, m]) => {
      setBars(b);
      setReports(r.slice(0, 20));
      setMovements(m.slice(0, 20));
      setLoading(false);
    });
  }, [festivalId]);

  const allowed = ROLE_ACCESS[role] || [];
  const today = new Date().toISOString().split("T")[0];
  const todayReports = reports.filter(r => r.report_date === today);
  const todayMovements = movements.filter(m => m.created_date?.startsWith(today));
  const canSeeMovements = allowed.includes("Movimentos");

  const allCards = [
    { key: "SubmitReport", title: "Relatório de Contagens", description: "Contagem de abertura, entrega ou fecho de um bar", icon: ClipboardList, color: "from-violet-500 to-purple-600", light: "bg-violet-50 text-violet-700" },
    { key: "DailySheet", title: "Folha Diária", description: "Ver todos os dados de stock dos bares para qualquer dia", icon: BarChart2, color: "from-teal-500 to-cyan-600", light: "bg-teal-50 text-teal-700" },
    { key: "Warehouse", title: "Armazém", description: "Stock atual, reabastecimentos e movimentos de stock", icon: Warehouse, color: "from-emerald-500 to-teal-600", light: "bg-emerald-50 text-emerald-700" },
    { key: "Setup", title: "Gerir Bares e Produtos", description: "Configurar bares, responsáveis e catálogo de produtos", icon: Package, color: "from-orange-500 to-amber-500", light: "bg-orange-50 text-orange-700" },
    { key: "Analytics", title: "Análise", description: "Consumo por dia, bar e produto · Relatório final", icon: BarChart2, color: "from-teal-500 to-cyan-600", light: "bg-teal-50 text-teal-700", managerOnly: true },
  ];

  const cards = allCards.filter(c => c.managerOnly ? role === "manager" : allowed.includes(c.key));

  const typeColors = { opening: "bg-blue-100 text-blue-700", delivery: "bg-amber-100 text-amber-700", night_delivery: "bg-indigo-100 text-indigo-700", closing: "bg-emerald-100 text-emerald-700" };
  const movTypeColors = { warehouse_to_bar: "bg-emerald-100 text-emerald-700", bar_to_bar: "bg-purple-100 text-purple-700", restock: "bg-blue-100 text-blue-700" };
  const movTypeLabels = { warehouse_to_bar: "Arm→Bar", bar_to_bar: "Bar→Bar", restock: "Reabastecimento" };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">
              {currentFestival ? currentFestival.name : "Festival Stock"}
            </h1>
            <p className="text-neutral-400 mt-1">
              {new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
              {currentFestival?.start_date ? ` · ${currentFestival.start_date}${currentFestival.end_date ? ` → ${currentFestival.end_date}` : ""}` : ""}
            </p>
          </div>
        </div>

        {isClosed && (
          <div className="mb-6 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" /> Festival fechado — não é possível submeter novos relatórios
          </div>
        )}

        {!festivalId && (
          <div className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-700">
            Nenhum festival selecionado.{" "}
            <button onClick={() => navigate("/FestivalSelect")} className="font-semibold underline">Selecionar festival</button>
          </div>
        )}

        {!loading && festivalId && (
          <div className={`grid gap-4 mb-8 ${canSeeMovements ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="text-3xl font-bold text-neutral-900">{bars.filter(b => b.is_active !== false).length}</div>
              <div className="text-sm text-neutral-400 mt-1">Bares Ativos</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="text-3xl font-bold text-neutral-900">{todayReports.length}</div>
              <div className="text-sm text-neutral-400 mt-1">Relatórios Hoje</div>
            </div>
            {canSeeMovements && (
              <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                <div className="text-3xl font-bold text-neutral-900">{todayMovements.length}</div>
                <div className="text-sm text-neutral-400 mt-1">Movimentos Hoje</div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="text-3xl font-bold text-neutral-900">{reports.length}</div>
              <div className="text-sm text-neutral-400 mt-1">Total Relatórios</div>
            </div>
          </div>
        )}

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

        {reports.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Relatórios Recentes</h2>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              {reports.slice(0, 5).map((r, i) => (
                <div key={r.id} className={`flex items-center gap-4 px-6 py-4 ${i < Math.min(reports.length, 5) - 1 ? "border-b border-neutral-50" : ""}`}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeColors[r.report_type] || "bg-neutral-100 text-neutral-600"}`}>
                    {reportTypeLabels[r.report_type] || r.report_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-neutral-900 truncate">{r.bar_name}</div>
                    <div className="text-xs text-neutral-400">{r.festival_day} · {r.report_date}{r.submitted_by ? ` · por ${r.submitted_by}` : ""}</div>
                  </div>
                  <Link to="/Reports" className="p-1.5 text-neutral-300 hover:text-neutral-700 transition-colors shrink-0" title="Ver e editar relatórios">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {canSeeMovements && movements.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Movimentos Recentes</h2>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              {movements.slice(0, 5).map((m, i) => (
                <div key={m.id} className={`flex items-center gap-4 px-6 py-4 ${i < Math.min(movements.length, 5) - 1 ? "border-b border-neutral-50" : ""}`}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${movTypeColors[m.type] || "bg-neutral-100 text-neutral-600"}`}>
                    {movTypeLabels[m.type] || m.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-neutral-900 truncate">{m.origin_name} → {m.destination_name}</div>
                    <div className="text-xs text-neutral-400">{m.festival_day}{m.submitted_by ? ` · por ${m.submitted_by}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
