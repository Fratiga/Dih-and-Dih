// Genera docs/informe-stats.md: revisa las cuentas de 5e de data/stats.js sin modificarlo.
// Uso: node tools/informe-stats.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const sb = {};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(raiz, "data", "stats.js"), "utf8"), sb);

const mod = v => Math.floor((v - 10) / 2);
const signo = n => (n >= 0 ? "+" : "") + n;
const competencia = n => (n <= 4 ? 2 : n <= 8 ? 3 : n <= 12 ? 4 : n <= 16 ? 5 : 6);
const ABIL = ["fue", "des", "con", "int", "sab", "car"];
const etiqueta = a => a.toUpperCase();

const filas = [];
const filasPv = [];
const sinChequear = [];
const resumen = { ataques: 0, ataquesOk: 0, cd: 0, cdOk: 0, pv: 0, pvOk: 0 };
const fila = (bloque, campo, actual, esperado, nota) =>
  filas.push(`| ${bloque} | ${campo} | ${actual} | ${esperado} | ${nota} |`);
const celda = s => String(s).replace(/\|/g, "\\|");

for (const b of sb.STATS) {
  const nivel = typeof b.nivel === "number" ? b.nivel : null;
  if (!b.stats) { sinChequear.push(`${b.id}: sin atributos (stats), no se puede calcular.`); continue; }
  const m = {};
  ABIL.forEach(a => (m[a] = mod(b.stats[a])));

  // Competencia: sin VD en el archivo, se usa "nivel" como equivalente.
  let pb = nivel === null ? null : competencia(nivel);
  if (nivel === null) sinChequear.push(`${b.id}: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).`);
  const textos = (b.habilidades || []).map(h => ({ h, t: h.descripcion }));

  // PV: no hay dados de golpe en el archivo. Se infiere la mejor expresión NdX + N*CON.
  if (typeof b.pv === "number") {
    const opciones = [6, 8, 10, 12].map(d => {
      const por = (d + 1) / 2 + m.con;
      if (por <= 0) return null;
      const n = Math.max(1, Math.round(b.pv / por));
      const total = Math.floor(n * por);
      return { d, n, total, err: b.pv - total, bonus: n * m.con };
    }).filter(Boolean).sort((p, q) => Math.abs(p.err) - Math.abs(q.err) || p.d - q.d);
    const mejor = opciones[0];
    resumen.pv++;
    const limpio = mejor && Math.abs(mejor.err) <= 1;
    if (limpio) resumen.pvOk++;
    const expr = o => `${o.n}d${o.d}${o.bonus >= 0 ? "+" : ""}${o.bonus}`;
    const dadosVsNivel = nivel === null ? "sin nivel" : mejor ? `${mejor.n} dados frente a nivel ${nivel}` : "";
    filasPv.push(`| ${b.id} | ${b.pv} | ${mejor ? `${expr(mejor)} (media ${mejor.total})` : "—"} | ${nivel === null ? "—" : nivel} | ${limpio ? "sí" : "no, error " + (mejor ? signo(mejor.err) : "—")} | ${celda(dadosVsNivel)}${limpio ? "" : celda(". Alternativas: " + opciones.slice(1, 3).map(o => `${expr(o)} (${o.total})`).join(", "))} |`);
    if (!limpio) fila(b.id, "pv", b.pv, mejor ? `${mejor.total} (${expr(mejor)})` : "—", celda(`Ninguna combinación d6 a d12 con la CON ${signo(m.con)} da este total exacto. Más cercana: ${mejor ? expr(mejor) : "—"}.`));
  }

  for (const { h, t } of textos) {
    for (const x of t.matchAll(/([+-]\d+)\s+(?:al impacto|al ataque)(?!\s+y)/g)) {
      const n = parseInt(x[1], 10);
      resumen.ataques++;
      const cand = pb === null ? null : ABIL.filter(a => a !== "con").map(a => ({ a, v: pb + m[a] }));
      if (cand === null) {
        // Competencia implícita
        const imp = ABIL.filter(a => a !== "con").map(a => `${etiqueta(a)} ${n - m[a]}`);
        const plausible = ABIL.some(a => a !== "con" && [2, 3, 4, 5, 6].includes(n - m[a]));
        if (plausible) resumen.ataquesOk++;
        else fila(b.id, `${h.nombre} (ataque)`, signo(n), "competencia + mod", celda(`Sin nivel. Competencia implícita: ${imp.join(", ")}. Ninguna cuadra con 2 a 6.`));
        continue;
      }
      if (cand.some(c => c.v === n)) { resumen.ataquesOk++; continue; }
      const fis = cand.filter(c => c.a === "fue" || c.a === "des").sort((p, q) => Math.abs(p.v - n) - Math.abs(q.v - n))[0];
      fila(b.id, `${h.nombre} (ataque)`, signo(n), signo(fis.v), celda(`Competencia ${signo(pb)} (nivel ${nivel}). ${cand.map(c => `${etiqueta(c.a)} ${signo(c.v)}`).join(", ")}.`));
    }
    for (const x of t.matchAll(/CD (\d+)/g)) {
      const n = parseInt(x[1], 10);
      resumen.cd++;
      if (pb === null) {
        const plausible = ABIL.some(a => [2, 3, 4, 5, 6].includes(n - 8 - m[a]));
        if (plausible) resumen.cdOk++;
        else fila(b.id, `${h.nombre} (CD)`, n, "8 + competencia + mod", celda("Sin nivel. Ninguna competencia entre 2 y 6 cuadra con ningún atributo."));
        continue;
      }
      const cand = ABIL.filter(a => a !== "con").map(a => ({ a, v: 8 + pb + m[a] }));
      if (cand.some(c => c.v === n) || 8 + pb + m.con === n) { resumen.cdOk++; continue; }
      const cercano = cand.sort((p, q) => Math.abs(p.v - n) - Math.abs(q.v - n))[0];
      fila(b.id, `${h.nombre} (CD)`, n, cercano.v, celda(`8 + competencia ${signo(pb)} + mod. Más cercano: ${etiqueta(cercano.a)}. ${cand.map(c => `${etiqueta(c.a)} ${c.v}`).join(", ")}, CON ${8 + pb + m.con}.`));
    }
  }
}

const md = `# Informe de estadísticas (data/stats.js)

Generado con \`node tools/informe-stats.js\`. No se modificó \`data/stats.js\`.

## Criterio

- El archivo no tiene valor de desafío. Se usa \`nivel\` en su lugar, con la tabla de competencia de 5e: 0 a 4 → +2, 5 a 8 → +3, 9 a 12 → +4, 13 a 16 → +5, 17 a 20 → +6.
- Bono de ataque esperado: competencia + modificador. Como el texto no dice qué atributo usa cada ataque, se acepta cualquiera de FUE, DES, INT, SAB o CAR. Solo aparece en la tabla si ninguno cuadra. En "esperado" va el de FUE o DES más cercano.
- CD esperada: 8 + competencia + modificador, aceptando cualquier atributo. En "esperado" va el valor más cercano al actual.
- PV: el archivo no tiene dados de golpe. Para cada bloque se busca la expresión NdX + N×CON (X entre 6 y 12) que más se acerca al PV. Se considera coherente si el total queda a 1 o menos. Como el número de dados es libre, casi siempre cuadra; lo útil es ver cuántos dados implica cada PV. El número de dados no se fuerza a ser igual al nivel; se muestra la comparación en la segunda tabla.
- Los bloques sin \`nivel\` numérico (milicianos, nombres propios sin nivel, etc.) no se pueden validar contra una competencia. Sí entran en la tabla de PV. Para ellos solo se comprueba que exista una competencia entre 2 y 6 que explique el número.
- Algunas diferencias son intencionales. Esta tabla solo señala las que no salen con la regla.

## Resumen

- Ataques revisados: ${resumen.ataques}, coherentes: ${resumen.ataquesOk}.
- CD revisadas: ${resumen.cd}, coherentes: ${resumen.cdOk}.
- PV revisados: ${resumen.pv}, coherentes: ${resumen.pvOk}.
- Diferencias en la tabla: ${filas.length}.

## Bloques que no se pudieron comprobar

${sinChequear.length ? sinChequear.map(s => "- " + s).join("\n") : "- Ninguno."}

## PV: dados de golpe inferidos

| bloque | pv | expresión inferida | nivel | coherente | nota |
|---|---|---|---|---|---|
${filasPv.join("\n")}

## Diferencias

| bloque | campo | valor actual | valor esperado | nota |
|---|---|---|---|---|
${filas.join("\n")}
`;
fs.writeFileSync(path.join(raiz, "docs", "informe-stats.md"), md);
console.log(`docs/informe-stats.md: ${filas.length} diferencias.`);
