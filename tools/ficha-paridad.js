// Genera, para una lista de fichas de ejemplo, un SQL que compara lo que calcula la función discord_i_ficha_resumen (docs/discord-3_extras.sql) con lo que
// calcula el navegador (js/fichas-calc.js): la CA, la competencia, la iniciativa y el modificador de cada atributo. Si alguien cambia las cuentas de la ficha en
// el navegador y no en SQL, o al revés, /ficha empezaría a contar otra cosa: por eso las dos se comparan.
// Uso:  node tools/ficha-paridad.js | psql ...      (cada línea del resultado es t o f; docs/pruebas/t_discord_extras.sh lo hace solo)
import fs from "node:fs";
import vm from "node:vm";

const RAIZ = new URL("..", import.meta.url);
const ctx = { window: {}, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("js/fichas-calc.js", RAIZ), "utf8"), ctx, { filename: "fichas-calc.js" });

const base = () => ({
  identidad: { nombre: "Caso", nivelTotal: 5 },
  atributos: { fue: 10, des: 16, con: 14, int: 8, sab: 12, car: 10 },
  ajustesAtributos: {},
  competenciaAjusteManual: 0,
  combate: { ca: { modo: "auto", armadura: 14, escudo: 2, incluyeDes: true, otros: 1, manual: 0 }, iniciativaAjuste: 0, pvActual: 30, pvMax: 40, pvTemp: 0 },
  salvaciones: {}, habilidades: {}
});
const con = (f) => { const p = base(); f(p); return p; };
const CASOS = [
  base(),
  con(p => { p.combate.ca.incluyeDes = false; }),
  con(p => { p.combate.ca.modo = "manual"; p.combate.ca.manual = 17; }),
  con(p => { p.combate.ca.modo = "manual"; p.combate.ca.manual = 0; }),
  con(p => { p.combate.ca.armadura = 0; p.combate.ca.escudo = 0; p.combate.ca.otros = 0; }),
  con(p => { p.identidad.nivelTotal = 1; }),
  con(p => { p.identidad.nivelTotal = 4; }),
  con(p => { p.identidad.nivelTotal = 5; }),
  con(p => { p.identidad.nivelTotal = 9; p.competenciaAjusteManual = 1; }),
  con(p => { p.identidad.nivelTotal = 21; }),
  con(p => { p.atributos.des = 13; p.ajustesAtributos = { des: 2, fue: -1 }; }),
  con(p => { p.atributos = { fue: 1, des: 3, con: 9, int: 11, sab: 20, car: 30 }; }),
  con(p => { p.combate.iniciativaAjuste = 3; p.atributos.des = 7; }),
  con(p => { p.combate.ca = { modo: "auto", armadura: 11, escudo: 0, incluyeDes: true, otros: 0, manual: 0 }; p.atributos.des = 20; p.ajustesAtributos = { des: 1 }; })
];

const lit = o => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
for (const p of CASOS) {
  const esperado = {
    ca: ctx.fichasCATotal(p), competencia: ctx.fichasCompetenciaTotal(p), iniciativa: ctx.fichasIniciativaTotal(p),
    mod: Object.fromEntries(["fue", "des", "con", "int", "sab", "car"].map(k => [k, ctx.fichasModificadorFinal(p, k)]))
  };
  const r = "discord_i_ficha_resumen(" + lit(p) + ")";
  const comparas = [
    `(${r} ->> 'ca')::numeric = ${esperado.ca}`, `(${r} ->> 'competencia')::numeric = ${esperado.competencia}`, `(${r} ->> 'iniciativa')::numeric = ${esperado.iniciativa}`,
    ...Object.entries(esperado.mod).map(([k, v]) => `(${r} -> 'atributos' -> '${k}' ->> 'mod')::numeric = ${v}`)];
  console.log(`select (${comparas.join(" and ")});`);
}
