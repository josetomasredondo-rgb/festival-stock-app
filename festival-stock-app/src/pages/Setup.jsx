import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Pencil, Check, X, Loader2 } from "lucide-react";
import db, { getFestivalBars, getFestivalProducts } from "../lib/db";
import { useAuth, useFestivalSettings, DEFAULT_SETTINGS } from "../lib/AuthContext";

// ── Bar card (view only — edits go to GlobalSettings) ────────────────────────
function BarItem({ bar }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
      <div className="font-semibold text-neutral-900">{bar.name}</div>
      {bar.leader_name && <div className="text-sm text-neutral-500 mt-0.5">Responsável: {bar.leader_name}</div>}
      {bar.location && <div className="text-xs text-neutral-400">{bar.location}</div>}
    </div>
  );
}

// ── Product item ──────────────────────────────────────────────────────────────
function ProductItem({ product }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm flex items-center justify-between">
      <div>
        <span className="font-medium text-neutral-900">{product.name}</span>
        <span className="text-neutral-400 text-sm ml-2">({product.unit || "units"})</span>
        {product.selling_price ? <span className="text-neutral-400 text-sm ml-2">€{product.selling_price}</span> : null}
      </div>
    </div>
  );
}

// ── Main Setup ────────────────────────────────────────────────────────────────
const TABS = ["bars", "products", "settings"];
const TAB_LABELS = { bars: "Bares", products: "Produtos", settings: "Configurações" };

export default function Setup() {
  const { role, currentFestival, setCurrentFestival } = useAuth();
  const { reportTypeLabels } = useFestivalSettings();
  const [tab, setTab] = useState("bars");
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const festivalId = currentFestival?.id;
  const isManager = role === "manager";

  // Report type labels form (editable)
  const [labelsForm, setLabelsForm] = useState(null);
  const [savingLabels, setSavingLabels] = useState(false);

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([getFestivalBars(currentFestival), getFestivalProducts(currentFestival)])
      .then(([b, p]) => { setBars(b); setProducts(p); setLoading(false); });

    const s = currentFestival?.settings || {};
    setLabelsForm({ ...DEFAULT_SETTINGS.report_type_labels, ...(s.report_type_labels || {}) });
  }, [festivalId]);

  const handleSaveLabels = async () => {
    setSavingLabels(true);
    const updated = await db.Festival.update(festivalId, {
      settings: { ...(currentFestival?.settings || {}), report_type_labels: labelsForm }
    });
    if (updated) setCurrentFestival(updated);
    setSavingLabels(false);
  };

  // Which tabs are visible
  const visibleTabs = isManager ? TABS : TABS.filter(t => t !== "settings");

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Configuração</h1>
          <p className="text-neutral-400 mt-1">{currentFestival?.name} · Bares, produtos e etiquetas deste festival</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {visibleTabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <>
            {/* ── Bares ── */}
            {tab === "bars" && (
              <div className="space-y-3">
                {bars.map(b => <BarItem key={b.id} bar={b} />)}
                {bars.length === 0 && (
                  <div className="text-center py-10 text-neutral-300 text-sm">
                    Sem bares atribuídos a este festival.
                    {isManager && <span> Atribui bares em <strong>Definições Globais</strong>.</span>}
                  </div>
                )}
              </div>
            )}

            {/* ── Produtos ── */}
            {tab === "products" && (
              <div className="space-y-2">
                {products.map(p => <ProductItem key={p.id} product={p} />)}
                {products.length === 0 && (
                  <div className="text-center py-10 text-neutral-300 text-sm">
                    Sem produtos atribuídos a este festival.
                    {isManager && <span> Atribui produtos em <strong>Definições Globais</strong>.</span>}
                  </div>
                )}
              </div>
            )}

            {/* ── Configurações (manager only) ── */}
            {tab === "settings" && isManager && labelsForm && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Nomes dos Tipos de Relatório</div>
                  <div className="space-y-2">
                    {[
                      { key: "opening", hint: "Abertura" },
                      { key: "delivery", hint: "Entrega" },
                      { key: "night_delivery", hint: "Entrega Noturna" },
                      { key: "closing", hint: "Fecho" },
                    ].map(({ key, hint }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400 w-32 shrink-0">{hint}</span>
                        <input type="text" value={labelsForm[key]}
                          onChange={e => setLabelsForm(f => ({ ...f, [key]: e.target.value }))}
                          className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveLabels} disabled={savingLabels}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {savingLabels ? <><Loader2 className="w-4 h-4 animate-spin" /> A guardar...</> : <><Check className="w-4 h-4" /> Guardar Configurações</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
