import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, Plus, Trash2, CheckCircle } from "lucide-react";
import db from "../lib/db";
import { useAuth, useFestivalSettings } from "../lib/AuthContext";

const REPORT_TYPE_COLORS = {
  opening: "border-blue-400 bg-blue-50 text-blue-800",
  delivery: "border-amber-400 bg-amber-50 text-amber-800",
  night_delivery: "border-indigo-400 bg-indigo-50 text-indigo-800",
  closing: "border-emerald-400 bg-emerald-50 text-emerald-800",
};
const REPORT_TYPE_DESCS = {
  opening: "Stock inicial no início do dia (preenchido automaticamente do dia anterior)",
  delivery: "Novo stock chegou durante o dia",
  night_delivery: "Stock entregue durante a noite entre dias",
  closing: "Stock final no fim do dia",
};

export default function SubmitReport() {
  const { role, user, currentFestival } = useAuth();
  const { dayNames, reportTypeLabels } = useFestivalSettings();
  const DAY_ORDER = dayNames;
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoFillInfo, setAutoFillInfo] = useState(null);
  const today = new Date().toISOString().split("T")[0];

  const festivalId = currentFestival?.id;
  const isClosed = currentFestival?.is_closed === true;

  // For bar_leader: only their bar; for others: all festival bars
  const isBarLeader = role === "bar_leader";
  const isNightDelivery = role === "night_delivery";

  const ALL_REPORT_TYPES = Object.entries(reportTypeLabels).map(([value, label]) => ({
    value, label, desc: REPORT_TYPE_DESCS[value], color: REPORT_TYPE_COLORS[value],
  }));
  const REPORT_TYPES = isNightDelivery
    ? ALL_REPORT_TYPES.filter(t => t.value === "night_delivery")
    : ALL_REPORT_TYPES;

  const [form, setForm] = useState({
    bar_id: "", bar_name: "", festival_day: "Day 1",
    report_date: today, report_type: isNightDelivery ? "night_delivery" : "", submitted_by: user?.name || "", notes: "", items: []
  });

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      db.Bar.filterByFestival(festivalId),
      db.Product.list(),
      db.StockReport.filterByFestival(festivalId, "-created_date"),
    ]).then(([b, p, r]) => {
      let activeBars = b.filter(bar => bar.is_active !== false);
      // bar_leader: only their assigned bar
      if (isBarLeader && user?.bar_id) {
        activeBars = activeBars.filter(bar => bar.id === user.bar_id);
      }
      setBars(activeBars);
      setProducts(p);
      setAllReports(r);
      // Auto-select bar for bar_leader
      if (isBarLeader && user?.bar_id) {
        const myBar = activeBars.find(bar => bar.id === user.bar_id);
        if (myBar) {
          setForm(f => ({ ...f, bar_id: myBar.id, bar_name: myBar.name }));
        }
      }
      setLoading(false);
    });
  }, [festivalId]);

  const computeAutoFillItems = (barId, festivalDay) => {
    const dayIndex = DAY_ORDER.indexOf(festivalDay);
    if (dayIndex <= 0) return null;
    const prevDay = DAY_ORDER[dayIndex - 1];
    const prevDayReports = allReports.filter(r => r.bar_id === barId && r.festival_day === prevDay);
    const closingReport = prevDayReports.find(r => r.report_type === "closing");
    const nightDeliveries = prevDayReports.filter(r => r.report_type === "night_delivery");
    if (!closingReport && nightDeliveries.length === 0) return null;
    const productMap = {};
    (closingReport?.items || []).forEach(item => {
      productMap[item.product_name] = { product_id: item.product_id, product_name: item.product_name, unit: item.unit, quantity: Number(item.quantity) || 0, notes: "" };
    });
    nightDeliveries.forEach(nd => {
      (nd.items || []).forEach(item => {
        if (productMap[item.product_name]) {
          productMap[item.product_name].quantity += Number(item.quantity) || 0;
        } else {
          productMap[item.product_name] = { product_id: item.product_id, product_name: item.product_name, unit: item.unit, quantity: Number(item.quantity) || 0, notes: "" };
        }
      });
    });
    return { items: Object.values(productMap), prevDay, hasNightDelivery: nightDeliveries.length > 0 };
  };

  const handleDayOrBarChange = (field, value) => {
    setForm(f => {
      const newForm = { ...f, [field]: value };
      if (field === "bar_id") {
        const bar = bars.find(b => b.id === value);
        newForm.bar_name = bar?.name || "";
      }
      const defaultItems = products.map(p => ({ product_id: p.id, product_name: p.name, unit: p.unit || "units", quantity: "", notes: "" }));
      if (field === "bar_id" && newForm.report_type) {
        if (newForm.report_type === "opening") {
          const autoFill = computeAutoFillItems(newForm.bar_id, newForm.festival_day);
          if (autoFill) { setAutoFillInfo(autoFill); newForm.items = autoFill.items; }
          else { setAutoFillInfo(null); newForm.items = defaultItems; }
        } else {
          newForm.items = defaultItems;
        }
      } else if (field === "bar_id" && !newForm.report_type) {
        newForm.items = defaultItems;
      }
      return newForm;
    });
  };

  const handleReportTypeChange = (type) => {
    setForm(f => {
      const newForm = { ...f, report_type: type, items: [] };
      const defaultItems = products.map(p => ({ product_id: p.id, product_name: p.name, unit: p.unit || "units", quantity: "", notes: "" }));
      if (type === "opening" && f.bar_id) {
        const autoFill = computeAutoFillItems(f.bar_id, f.festival_day);
        if (autoFill) { setAutoFillInfo(autoFill); newForm.items = autoFill.items; }
        else { setAutoFillInfo(null); newForm.items = defaultItems; }
      } else {
        setAutoFillInfo(null);
        newForm.items = defaultItems;
      }
      return newForm;
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: "", product_name: "", unit: "units", quantity: "", notes: "" }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === "product_name") {
      const prod = products.find(p => p.name === value);
      if (prod) { items[idx].product_id = prod.id; items[idx].unit = prod.unit || "units"; }
    }
    return { ...f, items };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isClosed) return;
    setSubmitting(true);
    const payload = {
      ...form,
      festival_id: festivalId,
      items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 })).filter(i => i.product_name)
    };
    await db.StockReport.create(payload);
    setSubmitted(true);
    setSubmitting(false);
  };

  const resetForm = () => {
    setSubmitted(false);
    setAutoFillInfo(null);
    const newItems = isBarLeader && user?.bar_id
      ? { bar_id: user.bar_id, bar_name: bars[0]?.name || "" }
      : { bar_id: "", bar_name: "" };
    setForm({
      ...newItems, festival_day: "Day 1", report_date: today,
      report_type: isNightDelivery ? "night_delivery" : "",
      submitted_by: user?.name || "", notes: "", items: []
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Relatório Submetido!</h2>
          <p className="text-neutral-400 mb-6">O teu relatório foi guardado com sucesso.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetForm}
              className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors">
              Novo Relatório
            </button>
            <Link to="/Dashboard" className="px-5 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Relatório de Contagens</h1>
          <p className="text-neutral-400 mt-1">Submeter stock do teu bar · {currentFestival?.name}</p>
        </div>

        {isClosed && (
          <div className="mb-6 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            Festival fechado — não é possível submeter novos relatórios.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Bar</label>
                {isBarLeader ? (
                  <div className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 text-neutral-700">
                    {bars[0]?.name || "Sem bar atribuído"}
                  </div>
                ) : (
                  <select required value={form.bar_id} onChange={e => handleDayOrBarChange("bar_id", e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
                    <option value="">Seleciona um bar...</option>
                    {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Dia do Festival</label>
                  <select value={form.festival_day} onChange={e => handleDayOrBarChange("festival_day", e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
                    {DAY_ORDER.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Data</label>
                  <input type="date" value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))}
                    className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">O teu nome</label>
                <input type="text" placeholder="Nome do responsável do bar" value={form.submitted_by}
                  onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Tipo de Relatório</label>
              <div className="space-y-2">
                {REPORT_TYPES.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => handleReportTypeChange(t.value)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all ${form.report_type === t.value ? t.color + " border-2" : "bg-white border-neutral-200 hover:border-neutral-300"}`}
                  >
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {form.report_type && (
              <div>
                {autoFillInfo && form.report_type === "opening" && (
                  <div className="mb-3 flex items-start gap-2 text-xs bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-800">
                    <span className="text-base leading-none">✨</span>
                    <span>Preenchido automaticamente a partir do <strong>fecho do {autoFillInfo.prevDay}</strong>{autoFillInfo.hasNightDelivery ? " + entrega noturna" : ""}. Podes ajustar as quantidades abaixo.</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400">Produtos</label>
                  <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Adicionar produto
                  </button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-neutral-100 p-4 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-4">
                        <input type="text" placeholder="Nome do produto" value={item.product_name}
                          onChange={e => updateItem(idx, "product_name", e.target.value)}
                          list={`products-${idx}`}
                          className="w-full text-sm border-0 border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1 bg-transparent" />
                        <datalist id={`products-${idx}`}>{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" placeholder="Qtd" value={item.quantity}
                          onChange={e => updateItem(idx, "quantity", e.target.value)}
                          className="w-full text-sm border-0 border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1 bg-transparent" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" placeholder="Unid." value={item.unit}
                          onChange={e => updateItem(idx, "unit", e.target.value)}
                          className="w-full text-sm border-0 border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1 bg-transparent" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" placeholder="Notas" value={item.notes}
                          onChange={e => updateItem(idx, "notes", e.target.value)}
                          className="w-full text-sm border-0 border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1 bg-transparent" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button type="button" onClick={() => removeItem(idx)} className="text-neutral-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {form.items.length === 0 && (
                    <div className="text-center py-8 text-neutral-300 text-sm border-2 border-dashed border-neutral-200 rounded-xl">
                      Ainda sem produtos — clica em "Adicionar produto" acima
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Notas Gerais</label>
              <textarea rows={3} placeholder="Problemas, comentários ou observações..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none" />
            </div>

            <button type="submit" disabled={submitting || !form.report_type || !form.bar_id || isClosed}
              className="w-full py-3.5 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> A submeter...</> : "Submeter Relatório"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
