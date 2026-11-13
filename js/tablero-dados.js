/* =============================================================================
   TABLERO — dados. El parser local (modo sin conexión; con Supabase tira el servidor con la misma sintaxis,
   ver tablero_i_tirar en docs/admin/tablero.sql) y cómo se pintan las tiradas en el chat, al estilo de Roll20.
   Sintaxis: 1d20+5, 2d6+1d4-1, 2d20kh1, 2d20kl1, 4d6kh3, 3d6>4, 4df, 1d6!, 1d6!!, 1d6!p
============================================================================= */
(function () {
  const TERMINO = "(\\d*d(\\d+|f)(!!|!p|!)?(k[hl]\\d+)?([<>]\\d+)?|\\d+)";
  const VALIDA = new RegExp("^[+-]?" + TERMINO + "([+-]" + TERMINO + ")*$");

  function tirar(expr) {
    const v = String(expr || "").toLowerCase().replace(/\s+/g, "");
    if (!v || v.length > 80 || !VALIDA.test(v)) throw new Error("Tirada no válida. Usa algo como 1d20+5, 2d6+3 o 2d20kh1.");
    const re = /([+-]?)(\d*)d(\d+|f)(!!|!p|!)?(?:k([hl])(\d+))?(?:([<>])(\d+))?|([+-]?)(\d+)/g;
    let m, total = 0, dados = 0;
    const partes = [];
    while ((m = re.exec(v))) {
      if (m[3] !== undefined) {
        const signo = m[1] === "-" ? -1 : 1, n = parseInt(m[2] || "1", 10);
        const fudge = m[3] === "f", caras = fudge ? 3 : parseInt(m[3], 10), explota = m[4] || null;
        if (n < 1 || n > 100 || (!fudge && (caras < 2 || caras > 1000))) throw new Error("Entre 1 y 100 dados de 2 a 1000 caras.");
        if (fudge && explota) throw new Error("Los dados Fudge no explotan.");
        const uno = () => (fudge ? Math.floor(Math.random() * 3) - 1 : 1 + Math.floor(Math.random() * caras));
        const valores = [], extra = [];
        for (let i = 0; i < n; i++) {
          let r = uno(); dados++;
          if (explota === "!!") {
            let acc = r;
            while (r === caras && dados < 200) { r = uno(); dados++; acc += r; }
            valores.push(acc); extra.push(false);
          } else {
            valores.push(r); extra.push(false);
            while ((explota === "!" || explota === "!p") && r === caras && dados < 200) {
              r = uno(); dados++;
              valores.push(explota === "!p" ? r - 1 : r); extra.push(true);
            }
          }
        }
        let usados = valores.map(() => true);
        const k = parseInt(m[6] || "0", 10);
        if (m[5]) {
          if (k < 1 || k > valores.length) throw new Error("Te quedas con más dados de los que tiras.");
          const orden = valores.map((x, i) => i).sort((a, b) => (m[5] === "h" ? valores[b] - valores[a] : valores[a] - valores[b]) || a - b);
          usados = valores.map(() => false);
          orden.slice(0, k).forEach(i => { usados[i] = true; });
        }
        const objetivo = m[8] !== undefined ? parseInt(m[8], 10) : null;
        let suma = 0;
        valores.forEach((x, i) => {
          if (!usados[i]) return;
          if (!m[7]) suma += x;
          else if ((m[7] === ">" && x >= objetivo) || (m[7] === "<" && x <= objetivo)) suma += 1;
        });
        total += signo * suma;
        partes.push({ tipo: "dados", signo, n, caras: fudge ? "f" : String(caras), explota, guardar: m[5] ? m[5] + k : null,
          exito: m[7] ? m[7] + objetivo : null, valores, extra, usados, suma: signo * suma });
      } else {
        const valor = (m[9] === "-" ? -1 : 1) * parseInt(m[10], 10);
        total += valor;
        partes.push({ tipo: "numero", valor });
      }
    }
    if (dados > 200) throw new Error("Demasiados dados.");
    return { expr: v, total, partes };
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Un dado del desglose: máximo en verde, mínimo en rojo, descartado tachado */
  function dadoHtml(p, v, i) {
    const fudge = p.caras === "f";
    const caras = fudge ? 1 : parseInt(p.caras, 10);
    const txt = fudge ? (v > 0 ? "+" : v < 0 ? "−" : "0") : v;
    const cls = ["tb-d"];
    if (!p.usados[i]) cls.push("descartado");
    else if (!fudge && v >= caras && !p.exito) cls.push("max");
    else if (!fudge && v === 1 && !p.exito) cls.push("min");
    if (p.extra && p.extra[i]) cls.push("extra");
    return `<span class="${cls.join(" ")}">${txt}</span>`;
  }

  function desglose(t) {
    return (t.partes || []).map((p, j) => {
      const signo = j === 0 ? (p.tipo === "numero" && p.valor < 0 ? "−" : "") : (((p.tipo === "numero" ? p.valor : p.signo) < 0) ? " − " : " + ");
      if (p.tipo === "numero") return signo + Math.abs(p.valor);
      return signo + "(" + p.valores.map((v, i) => dadoHtml(p, v, i)).join("+") + ")";
    }).join("");
  }

  /* Texto que sale al pasar el ratón sobre una tirada en línea */
  function desgloseTexto(t) {
    return "Tirada " + t.expr + " = " + (t.partes || []).map(p => p.tipo === "numero" ? p.valor : "(" + p.valores.join("+") + ")").join(" ");
  }

  /* Crítico (20 natural) o pifia (1 natural) en un d20 que cuenta */
  function marcaD20(t) {
    let crit = false, pifia = false;
    (t.partes || []).forEach(p => {
      if (p.tipo !== "dados" || p.caras !== "20" || p.exito) return;
      p.valores.forEach((v, i) => { if (!p.usados[i]) return; if (v === 20) crit = true; if (v === 1) pifia = true; });
    });
    return crit && !pifia ? "crit" : pifia && !crit ? "pifia" : crit && pifia ? "ambos" : "";
  }

  /* Una tirada completa como la muestra Roll20: "tirando 1d20+4", el desglose y el total */
  function tiradaHtml(t) {
    if (!t) return "";
    if (t.secreta) return `<div class="tb-tirada"><div class="tb-tirada-expr">Tirada secreta enviada al DJ</div></div>`;
    const etiqueta = t.etiqueta ? `<div class="tb-tirada-etq">${esc(t.etiqueta)}</div>` : "";
    return `<div class="tb-tirada ${marcaD20(t)}">${etiqueta}
      <div class="tb-tirada-expr">tirando ${esc(t.expr)}</div>
      <div class="tb-tirada-des">${desglose(t)}</div>
      <div class="tb-tirada-total"><span>=</span><b>${t.total}</b></div></div>`;
  }

  function enLineaHtml(t) {
    if (!t) return "";
    return `<span class="tb-enlinea ${marcaD20(t)}" title="${esc(desgloseTexto(t))}">${t.total}</span>`;
  }

  window.TBDados = { tirar, tiradaHtml, enLineaHtml, desgloseTexto, esc };
})();
