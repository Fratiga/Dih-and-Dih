// Comprueba que quien está conectado solo se ve dentro del mismo Side (js/presencia.js, presenciaPorLado).
// Uso (desde la raíz del proyecto):  node docs/pruebas-web/presencia_lados.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const codigo = fs.readFileSync(path.resolve(__dirname, "..", "..", "js", "presencia.js"), "utf8");
let fallos = 0;
const comprobar = (t, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  console.log((ok ? "  OK   " : "  FALLA ") + t + (ok ? "" : ` (esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)})`));
  if (!ok) fallos++;
};

// Un «Supabase» en memoria: los canales con el mismo nombre comparten estado, como en el servidor
function servidor() {
  const canales = {};
  return {
    cliente(miId) {
      return {
        channel(nombre, op) {
          const estado = canales[nombre] || (canales[nombre] = { gente: {}, oyentes: [] });
          const c = {
            on(_t, _f, cb) { estado.oyentes.push(cb); return c; },
            subscribe(cb) { Promise.resolve().then(() => cb("SUBSCRIBED")); return c; },
            track(meta) { estado.gente[op.config.presence.key] = [meta]; estado.oyentes.forEach(f => f()); return Promise.resolve(); },
            presenceState() { return estado.gente; },
            nombre
          };
          return c;
        }
      };
    }
  };
}

function jugador(srv, id, lado, admin) {
  const store = { compendioLado: lado || "", compendioAdmin: admin ? "1" : "0" };
  const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null) }, document: {}, window: {}, location: { pathname: "/index.html" }, console };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  const nombres = [];
  const cliente = srv.cliente(id);
  const original = cliente.channel;
  cliente.channel = (n, o) => { nombres.push(n); return original(n, o); };
  const p = ctx.presenciaPorLado(cliente, "lobby-presencia", id, () => {}, () => ({ nombre: id }));
  return { p, nombres };
}

(async () => {
  const srv = servidor();
  const a1 = jugador(srv, "a1", "A"), a2 = jugador(srv, "a2", "A"), b1 = jugador(srv, "b1", "B"), s1 = jugador(srv, "s1", ""), adm = jugador(srv, "adm", "A", true);
  await new Promise(r => setTimeout(r, 20));
  [a1, a2, b1, s1, adm].forEach(j => j.p.anunciar());
  await new Promise(r => setTimeout(r, 20));

  console.log("== Canales a los que se une cada quien");
  comprobar("un jugador del Side A solo se une al canal del Side A", a1.nombres, ["lobby-presencia-A"]);
  comprobar("uno del Side B solo al del B", b1.nombres, ["lobby-presencia-B"]);
  comprobar("quien no eligió Side, al de «sin»", s1.nombres, ["lobby-presencia-sin"]);
  comprobar("el Admin se une a todos", adm.nombres.slice().sort(), ["lobby-presencia-A", "lobby-presencia-B", "lobby-presencia-sin"]);

  console.log("== Quién ve a quién");
  const ve = j => Object.keys(j.p.estado()).sort();
  comprobar("el Side A ve a los del Side A (y al Admin, que se anuncia en el A)", ve(a1), ["a1", "a2", "adm"]);
  comprobar("el Side B solo se ve a sí mismo", ve(b1), ["b1"]);
  comprobar("quien no tiene Side solo se ve a sí mismo", ve(s1), ["s1"]);
  comprobar("el Admin ve a todos", ve(adm), ["a1", "a2", "adm", "b1", "s1"]);

  console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.");
  process.exit(fallos ? 1 : 0);
})();
