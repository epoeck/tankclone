/** Painel de teste: stats do atacante e do alvo → dano (fórmula do core). */
import { REFERENCE_STATS, WEAPONS, ZERO_STATS, armorReduction, combatPower, critBonusPct, critChancePct, damageBreakdown, totalArmor, type Stats } from "@tankclone/core";

const keys: Array<[keyof Stats, string]> = [["atk", "Ataque"], ["def", "Defesa"], ["agi", "Agilidade"], ["luck", "Sorte"], ["hp", "Vida"], ["armor", "Armadura"], ["damage", "Dano"]];
const out = document.getElementById("out")!;
const inputs: Record<"atk" | "tgt", Record<string, HTMLInputElement>> = { atk: {}, tgt: {} };

function build(host: "atk" | "tgt") {
  const el = document.getElementById(host)!;
  for (const [k, label] of keys) {
    const l = document.createElement("label");
    l.innerHTML = `<span>${label}</span><input type="number" min="0" step="1" value="${ZERO_STATS[k]}">`;
    const i = l.querySelector("input")!; i.oninput = render; inputs[host][k] = i; el.append(l);
  }
}
build("atk"); build("tgt");

const opt = document.getElementById("opt")!;
opt.innerHTML = `<label><span>Arma</span><select id="w">${Object.values(WEAPONS).map(w => `<option value="${w.id}">${w.name} (${w.baseDamage})</option>`).join("")}</select></label>
<label><span>Bônus (%)</span><input id="b" type="number" value="0" step="10"></label>
<label><span>Mult. projétil</span><input id="m" type="number" value="1" step="0.1"></label>
<label><span>Queda radial</span><input id="f" type="number" value="1" step="0.05" min="0" max="1"></label>
<label><span>Crítico</span><input id="c" type="checkbox"></label>`;
for (const e of opt.querySelectorAll("input,select")) (e as HTMLElement).oninput = render;
(document.getElementById("c") as HTMLInputElement).onchange = render;
(document.getElementById("ref") as HTMLButtonElement).onclick = () => {
  for (const h of ["atk", "tgt"] as const) for (const [k] of keys) inputs[h][k]!.value = String(REFERENCE_STATS[k]);
  render();
};

const read = (h: "atk" | "tgt"): Stats => Object.fromEntries(keys.map(([k]) => [k, +inputs[h][k]!.value || 0])) as unknown as Stats;
const val = (id: string) => +(document.getElementById(id) as HTMLInputElement).value;

function render() {
  const a = read("atk"), t = read("tgt");
  const weapon = WEAPONS[(document.getElementById("w") as HTMLSelectElement).value]!;
  const crit = (document.getElementById("c") as HTMLInputElement).checked;
  const b = damageBreakdown({ weapon, attacker: a, target: t, bonus: val("b") / 100, shotMult: val("m"), falloff: val("f"), crit });
  out.innerHTML = `Dano bruto: <b>${b.gross.toFixed(1)}</b><br>
    Armadura do alvo: <b>${totalArmor(t).toFixed(0)}</b> → redução <b>${(armorReduction(t) * 100).toFixed(1)}%</b><br>
    Crítico do atacante: chance <b>${critChancePct(a.luck).toFixed(1)}%</b>, bônus <b>${critBonusPct(a.luck).toFixed(1)}%</b><br>
    <big>Dano final: <b>${b.final}</b></big> (${((b.final / t.hp) * 100).toFixed(2)}% da vida do alvo; ${Math.ceil(t.hp / b.final)} tiros para matar)<br>
    FC atacante: <b>${combatPower(a).toLocaleString("pt-BR")}</b> · FC alvo: <b>${combatPower(t).toLocaleString("pt-BR")}</b>`;
}
render();
