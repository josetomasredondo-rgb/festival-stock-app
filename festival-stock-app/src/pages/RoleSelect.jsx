import { useState } from "react";
import { Lock } from "lucide-react";

const ROLES = [
  {
    key: "bar_leader",
    label: "Responsável de Bar",
    description: "Submeter e ver relatórios de stock",
    pin: "1111",
    color: "from-violet-500 to-purple-600",
  },
  {
    key: "event_coordinator",
    label: "Coordenador de Evento",
    description: "Acesso total exceto financeiros",
    pin: "2222",
    color: "from-emerald-500 to-teal-600",
  },
  {
    key: "manager",
    label: "Gestor da Empresa",
    description: "Acesso total incluindo financeiros",
    pin: "3333",
    color: "from-amber-500 to-orange-500",
  },
];

export default function RoleSelect({ onRoleSelected }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleRoleClick = (role) => {
    setSelected(role);
    setPin("");
    setError("");
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    if (pin === selected.pin) {
      onRoleSelected(selected.key);
    } else {
      setError("PIN incorreto. Tenta novamente.");
      setPin("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-2xl mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Quem és tu?</h1>
          <p className="text-neutral-400 mt-1 text-sm">Seleciona o teu perfil para continuar</p>
        </div>

        {!selected ? (
          <div className="space-y-3">
            {ROLES.map((role) => (
              <button
                key={role.key}
                onClick={() => handleRoleClick(role)}
                className="w-full bg-white rounded-2xl border border-neutral-200 p-4 text-left hover:border-neutral-400 hover:shadow-sm transition-all group"
              >
                <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${role.color} mb-3`} />
                <div className="font-semibold text-neutral-900">{role.label}</div>
                <div className="text-sm text-neutral-400 mt-0.5">{role.description}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-neutral-400 hover:text-neutral-700 mb-4 flex items-center gap-1"
            >
              ← Voltar
            </button>
            <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${selected.color} mb-4`} />
            <h2 className="font-bold text-neutral-900 mb-1">{selected.label}</h2>
            <p className="text-sm text-neutral-400 mb-6">{selected.description}</p>
            <form onSubmit={handleConfirm}>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                PIN de Acesso
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(""); }}
                placeholder="••••"
                autoFocus
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-neutral-900 mb-3"
              />
              {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
              <button
                type="submit"
                disabled={!pin}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
              >
                Entrar
              </button>
            </form>
            <p className="text-xs text-neutral-300 text-center mt-4">
              PINs padrão: Bar=1111 · Coord=2222 · Gestor=3333
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
