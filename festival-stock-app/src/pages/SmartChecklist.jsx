import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, AlertTriangle, ArrowRight } from "lucide-react";
import db, { getFestivalBars } from "../lib/db";
import { useAuth } from "../lib/AuthContext";

function computeConsumedByProduct(reports, movements, bars, dayNames) {
  const productMap = {};

  bars.forEach(bar => {
    dayNames.forEach(day => {
      const dr = reports.filter(r => r.bar_id === bar.id && r.festival_day === day);
      const opening = dr.find(r => r.report_type === "opening");
      const closing = dr.find(r => r.report_type === "closing");
      if (!opening || !closing) return;

      const delivs = dr.filter(r => ["delivery", "night_delivery"].includes(r.report_type));
      const dm = movements.filter(m => m.festival_day === day);
      const inMov = dm.filter(m => m.destination_type === "bar" && m.destination_id === bar.id);
      const outMov = dm.filter(m => m.origin_type === "bar" && m.origin_id === bar.id);

      const names = [...new Set([
        ...(opening.items || []).map(i => i.product_name),
        ...(closing.items || []).map(i => i.product_name),
      ])].filter(Boolean);

      names.forEach(name => {
        const oQty = Number((opening.items || []).find(i => i.product_name === name)?.quantity);
        const cQty = Number((closing.items || []).find(i => i.product_name === name)?.quantity);
        if (isNaN(oQty) || isNaN(cQty)) return;

        const unit = (opening.items || []).find(i => i.product_name === name)?.unit || "";
        const dQty = delivs.reduce((s, d) => s + (Number((d.items || []).find(i => i.product_name === name)?.quantity) || 0), 0);
        const iQty = inMov.reduce((s, m) => s + (Number((m.items || []).find(i => i.product_name === name)?.quantity) || 0), 0);
        const eQty = outMov.reduce((s, m) => s + (Number((m.items || []).find(i => i.product_name === name)?.quantity) || 0), 0);

        const consumed = oQty + dQty + iQty - eQty - cQty;
        if (consumed <= 0) return;

        if (!productMap[name]) productMap[name] = { consumed: 0, unit, waste: 0 };
        productMap[name].consumed += consumed;
      });
    });

    // Waste: last closing per bar
    const lastDay = [...dayNames].reverse().find(day =>
      reports.some(r => r.bar_id === bar.id && r.festival_day === day && r.report_type === "closing")
    );
    if (!lastDay) return;
    const lc = reports.find(r => r.bar_id === bar.id && r.festival_day === lastDay && r.report_type === "closing");
    (lc?.items || []).forEach(item => {
      if (!productMap[item.product_name]) return;
      productMap[item.product_name].waste += Number(item.quantity) || 0;
    });
  });

  return productMap;
}

export default function SmartChecklist() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [festivals, setFestivals] = useState([]);
  const [refId, setRefId] = useState("");
  const [refBars, setRefBars] = useState([]);
  const [refReports, setRefReports] = useState([]);
  const [refMovements, setRefMovements] = useState([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [params, setParams] = useState({ name: "", num_days: 1, num_bars: 1, attendance: 0 });

  useEffect(() => {
    db.Festival.list().then(fs => setFestivals(fs));
  }, []);

  const refFestival = festivals.find(f => f.id === refId);

  useEffect(() => {
    if (!refId || !refFestival) { setRefBars([]); setRefReports([]); setRefMovements([]); return; }
    setLoadingRef(true);
    Promise.all([
      getFestivalBars(refFestival),
      db.StockReport.filterByFestival(refId),
      db.Movement.filterByFestival(refId),
    ]).then(([b, r, m]) => { setRefBars(b); setRefReports(r); setRefMovements(m); setLoadingRef(false); });
  }, [refId]);

  const refDayNames = refFestival?.day_names?.length
    ? refFestival.day_names
    : Array.from({ length: refFestival?.num_days || 1 }, (_, i) => `Dia ${i + 1}`);

  const refProductMap = (refBars.length > 0 && refReports.length > 0)
    ? computeConsumedByProduct(refReports, refMovements, refBars, refDayNames)
    : {};

  const checklist = Object.entries(refProductMap).map(([name, { consumed, unit, waste }]) => {
    const refDays = refDayNames.length;
    const refAtt = refFestival?.expected_attendance || 0;
    const newDays = Number(params.num_days) || 1;
    const newAtt = Number(params.attendance) || 0;

    let adjusted = consumed * (newDays / refDays);
    if (refAtt > 0 && newAtt > 0) adjusted *= (newAtt / refAtt);
    adjusted = Math.round(adjusted);

    const buffer = Math.ceil(adjusted * 0.1);
    const suggested = adjusted + buffer;

    const totalRef = consumed + waste;
    const wasteRate = totalRef > 0 ? Math.round((waste / totalRef) * 100) : 0;

    return { name, base: consumed, adjusted, buffer, suggested, unit, wasteRate, waste };
  }).sort((a, b) => b.base - a.base);

  const handleCreateFestival = () => {
    sessionStorage.setItem("smartChecklistData", JSON.stringify({
      name: params.name,
      num_days: params.num_days,
      suggestions: checklist.map(r => ({ product_name: r.name, suggested: r.suggested, unit: r.unit })),
    }));
    navigate("/GlobalSettings");
  };

  const attScalingEnabled = (refFestival?.expected_attendance || 0) > 0 && Number(params.attendance) > 0;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8 print:hidden">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-8 print:hidden">
          <h1 className="text-3xl font-bold text-neutral-900">Preparar Próximo Evento</h1>
          <p className="text-neutral-400 mt-1">Gera uma checklist de stock com base em eventos anteriores</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8 print:hidden">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-500"}`}>{s}</div>
              {s < 3 && <div className={`h-0.5 w-10 rounded ${step > s ? "bg-neutral-900" : "bg-neutral-200"}`} />}
            </div>
          ))}
          <div className="ml-2 text-sm text-neutral-500 font-medium">
            {step === 1 ? "Selecionar referência" : step === 2 ? "Parâmetros do evento" : "Checklist gerada"}
          </div>
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm space-y-4">
              <div>
                <h2 className="font-semibold text-neutral-900 mb-1">Selecionar festival de referência</h2>
                <p className="text-sm text-neutral-400">O consumo histórico deste festival será a base do cálculo.</p>
              </div>

              <select value={refId} onChange={e => setRefId(e.target.value)}
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                <option value="">Selecionar festival...</option>
                {festivals.map(f => <option key={f.id} value={f.id}>{f.name}{f.is_closed ? " (fechado)" : ""}</option>)}
              </select>

              {refFestival && (
                <div className="border border-neutral-100 rounded-xl p-4 bg-neutral-50 space-y-1 text-sm">
                  <div className="font-semibold text-neutral-800">{refFestival.name}</div>
                  <div className="text-neutral-500">{refDayNames.length} dia{refDayNames.length !== 1 ? "s" : ""} · {refBars.length} bar{refBars.length !== 1 ? "es" : ""}</div>
                  {(refFestival.expected_attendance || 0) > 0 && (
                    <div className="text-neutral-500">Previsão de pessoas: {refFestival.expected_attendance}</div>
                  )}
                  {!loadingRef && Object.keys(refProductMap).length > 0 && (
                    <div className="text-emerald-700 text-xs font-medium mt-1">{Object.keys(refProductMap).length} produtos com dados de consumo</div>
                  )}
                  {!loadingRef && Object.keys(refProductMap).length === 0 && (
                    <div className="text-amber-700 text-xs mt-1">Sem dados de consumo suficientes — são precisos relatórios de abertura e fecho</div>
                  )}
                  {loadingRef && <div className="text-neutral-400 text-xs">A carregar dados...</div>}
                </div>
              )}
            </div>

            <button onClick={() => setStep(2)} disabled={!refId || Object.keys(refProductMap).length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40 transition-colors">
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm space-y-5">
              <h2 className="font-semibold text-neutral-900">Parâmetros do novo evento</h2>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Nome do festival</label>
                <input type="text" placeholder="Nome do festival" value={params.name}
                  onChange={e => setParams(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Nº de dias</label>
                  <input type="number" min="1" max="15" value={params.num_days}
                    onChange={e => setParams(p => ({ ...p, num_days: Number(e.target.value) || 1 }))}
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Nº de bares</label>
                  <input type="number" min="1" value={params.num_bars}
                    onChange={e => setParams(p => ({ ...p, num_bars: Number(e.target.value) || 1 }))}
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Previsão de pessoas</label>
                  <input type="number" min="0" value={params.attendance}
                    onChange={e => setParams(p => ({ ...p, attendance: Number(e.target.value) || 0 }))}
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              </div>

              {(refFestival?.expected_attendance || 0) === 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  O festival de referência não tem previsão de pessoas configurada — o escalonamento por público não será aplicado. Podes defini-lo em Definições Globais.
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="px-6 py-3 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                Voltar
              </button>
              <button onClick={() => setStep(3)}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors">
                Gerar checklist <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h2 className="font-semibold text-neutral-900">
                  Checklist para {params.name || "novo festival"}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Base: {refFestival?.name} · {refDayNames.length} dia{refDayNames.length !== 1 ? "s" : ""}
                  {(refFestival?.expected_attendance || 0) > 0 && ` · ${refFestival.expected_attendance} pessoas`}
                  {" → "}
                  {params.num_days} dia{params.num_days !== 1 ? "s" : ""}
                  {Number(params.attendance) > 0 && ` · ${params.attendance} pessoas`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Base histórica</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-blue-400">Ajustado</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">+Buffer 10%</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-emerald-600">Sugerido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {checklist.map(row => (
                      <tr key={row.name} className={`hover:bg-neutral-50 ${row.wasteRate > 15 ? "bg-amber-50/50" : ""}`}>
                        <td className="px-6 py-3">
                          <div className="font-medium text-neutral-800">{row.name}</div>
                          {row.wasteRate > 15 && (
                            <div className="flex items-center gap-1 text-xs text-amber-700 mt-0.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {row.name} teve {row.wasteRate}% de desperdício — considera reduzir a encomenda
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-500">{row.base} {row.unit}</td>
                        <td className="px-4 py-3 text-center text-blue-700 font-medium">{row.adjusted} {row.unit}</td>
                        <td className="px-4 py-3 text-center text-neutral-400">+{row.buffer}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700">{row.suggested} {row.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-sm text-blue-800">
              <div className="font-semibold mb-1">Como é calculado?</div>
              <div>
                Base histórica × (novos dias ÷ dias de referência)
                {attScalingEnabled ? " × (nova previsão ÷ previsão de referência)" : ""}
                {" "}+ 10% de buffer de segurança.
              </div>
              {!attScalingEnabled && (
                <div className="mt-1 text-blue-700 text-xs">
                  Define a previsão de pessoas no evento de referência e no novo evento para incluir escalonamento por público.
                </div>
              )}
            </div>

            <div className="flex gap-3 flex-wrap print:hidden">
              <button onClick={() => setStep(2)}
                className="px-6 py-3 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                Voltar
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3 border border-neutral-200 bg-white rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                <Download className="w-4 h-4" /> Exportar PDF
              </button>
              <button onClick={handleCreateFestival}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors">
                Criar festival com esta lista <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
