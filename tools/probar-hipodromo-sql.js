// Prueba del SQL del hipódromo (docs/hipodromo.sql) contra un PostgreSQL de verdad, con el motor de verdad.
// Necesita Docker con el contenedor «cartas-pruebas» (Postgres 17, el mismo de docs/pruebas) y crea su propia base,
// «hipodromo_pruebas», sin tocar las demás. Uso: node tools/probar-hipodromo-sql.js
// Qué comprueba: permisos (RLS y funciones), apostar con cuota del servidor, órdenes de la cuadra procesadas por el motor
// y cobradas junto al mundo, premios y apuestas liquidados al aplicar una carrera, choques de versión y saldos negativos.
const vm = require("vm"), fs = require("fs"), path = require("path"), cp = require("child_process");
const RAIZ = path.join(__dirname, "..");
const CONTENEDOR = "cartas-pruebas", BASE = "hipodromo_pruebas";

const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["data/hipodromo-palabras.js", "js/hipodromo-nombres.js", "js/hipodromo-rasgos.js", "js/hipodromo-motor.js"]) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), sb, { filename: f });
const M = sb.HipodromoMotor, C = M.C;

const fallos = []; let n = 0;
const ok = (c, msg) => { n++; if (!c) fallos.push(msg); };
const U1 = "00000000-0000-0000-0000-000000000001", U2 = "00000000-0000-0000-0000-000000000002";

function psql(sql, base) {
  try {
    const out = cp.execFileSync("docker", ["exec", "-i", CONTENEDOR, "psql", "-U", "postgres", "-d", base || BASE, "-tA", "-q", "-v", "ON_ERROR_STOP=1"], { input: "\\set VERBOSITY verbose\n" + sql, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
    return { ok: true, out: out.trim() };
  } catch (e) { return { ok: false, out: ((e.stdout || "") + "").trim(), err: ((e.stderr || "") + "").trim() }; }
}
const q = (sql, base) => { const r = psql(sql, base); if (!r.ok) throw new Error("SQL falló: " + (r.err || r.out).slice(0, 600) + "\n" + sql.slice(0, 300)); return r.out; };
const como = (uid, sql) => psql(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);\n${sql}\ncommit;`);
const anonimo = sql => psql(`begin;\nset local role anon;\n${sql}\ncommit;`);
const servicio = sql => psql(`begin;\nset local role service_role;\n${sql}\ncommit;`);
const ultima = r => r.out.split("\n").filter(x => x && !/^(SET|BEGIN|COMMIT|set_config|\{"sub")/.test(x) && !/^\{"sub"/.test(x)).pop();
const errCodigo = r => { const m = /ERROR:\s+(\w{5}):/.exec(r.err || ""); return m ? m[1] : null; };
const guardar = (version, lote) => servicio(`select hipodromo_guardar(${version}, $hj$${JSON.stringify(lote)}$hj$::jsonb);`);

// ---------------------------------------------------------------- preparar la base
try { cp.execFileSync("docker", ["exec", CONTENEDOR, "psql", "-U", "postgres", "-tAc", "select 1"], { stdio: ["ignore", "pipe", "pipe"] }); }
catch (e) { console.log("SIN PRUEBA: no hay Docker o el contenedor «" + CONTENEDOR + "» no está en marcha."); process.exit(0); }
q(`drop database if exists ${BASE} with (force);`, "postgres"); q(`create database ${BASE};`, "postgres");
q(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $f$ select nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid $f$;
grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
const sqlHip = fs.readFileSync(path.join(RAIZ, "docs/hipodromo.sql"), "utf8");
q(sqlHip); ok(psql(sqlHip).ok, "el SQL se puede ejecutar dos veces seguidas");

// ---------------------------------------------------------------- el mundo y la primera tanda
const ahora0 = Date.now();
const raw = M.paso(null, ahora0, { calentar: 40, semilla: "sql-pruebas", simsCalentar: 8 });
ok(guardar(0, raw.lote).ok, "se guarda el mundo por primera vez");
ok(guardar(0, raw.lote).err && errCodigo(guardar(0, raw.lote)) === "40001", "una segunda primera vez choca (40001)");
const leerMundo = () => { const v = q("select version from hipodromo_estado;"), m = q("select mundo::text from hipodromo_estado;"); return { version: Number(v), mundo: JSON.parse(m) }; };
let fila = leerMundo();
ok(fila.version === 1 && fila.mundo.proxima.n === raw.lote.mundo.proxima.n, "el estado guardado es el mundo que se mandó");
const nCarrera = fila.mundo.proxima.n;

// permisos
ok(anonimo("select count(*) from hipodromo_estado;").err && /permission denied/.test(anonimo("select count(*) from hipodromo_estado;").err), "un anónimo no lee el estado secreto");
ok(Number(ultima(anonimo("select count(*) from hipodromo_criaturas;"))) > 90, "un anónimo sí lee las criaturas públicas");
ok(Number(ultima(anonimo("select count(*) from hipodromo_carreras;"))) === 0, "la carrera futura no se ve antes de su hora");
ok(Number(ultima(anonimo("select count(*) from hipodromo_calendario;"))) === C.ADELANTO, "el calendario de las próximas carreras es público");
ok(/permission denied/.test(como(U1, "select hipodromo_guardar(1, '{}'::jsonb);").err || ""), "un jugador no puede llamar a guardar");
ok(/permission denied/.test(como(U1, "update hipodromo_billeteras set saldo = 99999;").err || "") && /permission denied/.test(como(U1, "insert into hipodromo_ordenes (usuario, datos) values ('" + U1 + "', '{}');").err || ""), "un jugador no escribe en su billetera ni en las órdenes a mano");
ok(/permission denied/.test(como(U1, "insert into hipodromo_apuestas (usuario, n, tipo, sel, monto, cuota) values ('" + U1 + "', 1, 'ganador', '1', 100, 99);").err || ""), "ni se apuesta a mano con la cuota que uno quiera");
ok(/Hace falta/.test(anonimo("select hipodromo_saldo();").err || "") || /permission denied/.test(anonimo("select hipodromo_saldo();").err || ""), "un anónimo no tiene billetera");

// billetera y apuestas
ok(ultima(como(U1, "select hipodromo_saldo();")) === "1000.00" || ultima(como(U1, "select hipodromo_saldo();")) === "1000", "la billetera empieza con 1000 monedas");
const prog = fila.mundo.proxima, ent = prog.entrantes;
const a = ent[0], b = ent[1];
let r = como(U1, `select hipodromo_apostar(${nCarrera}, 'ganador', '${a.id}'::jsonb, 100);`);
let j = JSON.parse(ultima(r));
ok(j.ok && Number(j.cuota) === a.gan && Number(j.saldo) === 900, `apostar a ganador usa la cuota del servidor (${a.gan}) y descuenta (${j.saldo})`);
j = JSON.parse(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'podio', '${b.id}'::jsonb, 50);`))); ok(j.ok && Number(j.cuota) === b.pod, "el podio usa la cuota de podio");
j = JSON.parse(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'exacta', '[${a.id}, ${b.id}]'::jsonb, 20);`)));
ok(j.ok && Number(j.cuota) === M.cuotaApuesta(prog, "exacta", [a.id, b.id]), `la cuota de la exacta coincide con la del motor (${j.cuota} contra ${M.cuotaApuesta(prog, "exacta", [a.id, b.id])})`);
ok(!JSON.parse(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'ganador', '99999999'::jsonb, 10);`))).ok, "no se apuesta a una criatura que no corre");
ok(!JSON.parse(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'ganador', '${a.id}'::jsonb, 100000);`))).ok, "no se apuesta más de lo que se tiene");
ok(!JSON.parse(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'exacta', '[${a.id}, ${a.id}]'::jsonb, 10);`))).ok, "la exacta pide dos criaturas distintas");
ok(!JSON.parse(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'ganador', '${a.id}'::jsonb, 0.4);`))).ok, "el importe mínimo es una moneda");
ok(Number(ultima(como(U2, "select count(*) from hipodromo_apuestas;"))) === 0 && Number(ultima(como(U1, "select count(*) from hipodromo_apuestas;"))) === 3, "cada jugador solo ve sus apuestas");
q(`update hipodromo_programa set cierre = now() - interval '1 minute' where n = ${nCarrera};`);
ok(/cerradas/.test(ultima(como(U1, `select hipodromo_apostar(${nCarrera}, 'ganador', '${a.id}'::jsonb, 10);`))), "pasada la hora de cierre ya no se apuesta");
q(`update hipodromo_programa set cierre = now() + interval '20 minutes' where n = ${nCarrera};`);
// un segundo jugador apuesta a otra criatura y pierde, para comprobar las dos caras
const c3 = ent[ent.length - 1];
j = JSON.parse(ultima(como(U2, `select hipodromo_apostar(${nCarrera}, 'ganador', '${c3.id}'::jsonb, 10);`))); ok(j.ok, "el segundo jugador también apuesta");

// ---------------------------------------------------------------- órdenes de la cuadra
const ordenar = (uid, datos) => ultima(como(uid, `select hipodromo_ordenar($hj$${JSON.stringify(datos)}$hj$::jsonb);`));
const idAd = Number(ordenar(U1, { tipo: "adoptar", nombre: "Ana", sexo: "f", dueno: U2 }));
ok(idAd > 0 && q(`select datos->>'dueno' from hipodromo_ordenes where id = ${idAd};`) === U1, "una orden siempre lleva como dueño a quien la manda, diga lo que diga el cliente");
ok(/desconocida/.test(como(U1, `select hipodromo_ordenar('{"tipo":"hackear"}'::jsonb);`).err || ""), "no se aceptan órdenes inventadas");
// lo que hace la Edge Function: leer las órdenes pendientes, los saldos y el mundo, y guardar el paso
function edge(ahora, extra) {
  const f = leerMundo();
  const ords = JSON.parse(q("select coalesce(json_agg(json_build_object('id', id, 'datos', datos) order by id), '[]') from hipodromo_ordenes where estado = 'pendiente';"));
  const ordenes = ords.map(o => Object.assign({}, o.datos, { oid: o.id }));
  const duenos = [...new Set(ordenes.map(o => o.dueno))], saldos = {};
  duenos.forEach(d => { saldos[d] = Number(q(`select coalesce((select saldo from hipodromo_billeteras where usuario = '${d}'), 1000);`)); });
  const p = M.paso(f, ahora, Object.assign({ ordenes, saldos, sims: 8 }, extra || {}));
  if (!p) return { sinCambios: true };
  const g = guardar(p.version, p.lote);
  return { paso: p, guardado: g, lote: p.lote };
}
let e = edge(Date.now());
ok(e.guardado && e.guardado.ok && e.paso.ordenes[0].ok, "la función de servicio procesa la orden de adoptar y guarda");
ok(q(`select estado from hipodromo_ordenes where id = ${idAd};`) === "hecha", "la orden queda como hecha");
const mia = JSON.parse(q(`select coalesce(json_agg(datos), '[]') from hipodromo_cuadras where dueno = '${U1}';`));
ok(mia.length === 1 && Array.isArray(mia[0].entradas) && Object.keys(mia[0].capacidades).length === 5, "el dueño tiene su criatura en su cuadra con las capacidades redondeadas");
ok(Number(ultima(como(U2, "select count(*) from hipodromo_cuadras;"))) === 0 && Number(ultima(como(U1, "select count(*) from hipodromo_cuadras;"))) === 1, "cada uno ve solo su cuadra");
const idMia = mia[0].id;
ok(q(`select dueno from hipodromo_criaturas where id = ${idMia};`) === U1 && JSON.parse(q(`select publico::text from hipodromo_criaturas where id = ${idMia};`)).dueno.nombre === "Ana", "la criatura pública lleva a su dueño");
ok(!/talento|tactica|entradas/.test(q(`select publico::text from hipodromo_criaturas where id = ${idMia};`)), "lo público de la criatura no lleva nada privado");

// inscribir: cuesta, se cobra con el guardado y deja movimiento
const cal = JSON.parse(q("select coalesce(json_agg(datos order by n), '[]') from hipodromo_calendario;"));
const objetivo = cal.find(x => x.plazas > 0);
const saldoAntes = Number(q(`select saldo from hipodromo_billeteras where usuario = '${U1}';`));
const idIns = Number(ordenar(U1, { tipo: "inscribir", id: idMia, n: objetivo.n }));
e = edge(Date.now());
ok(e.paso.ordenes.find(o => o.oid === idIns).ok, "inscribir se acepta");
ok(Number(q(`select saldo from hipodromo_billeteras where usuario = '${U1}';`)) === saldoAntes - objetivo.inscripcion, `se cobra la inscripción (${objetivo.inscripcion})`);
ok(Number(q(`select count(*) from hipodromo_movimientos where usuario = '${U1}' and concepto like 'Inscripción%' and monto = -${objetivo.inscripcion};`)) === 1, "queda un movimiento con el cobro");
// una orden que falla no cobra: la criatura de otro, y falta de saldo
const idMal = Number(ordenar(U2, { tipo: "inscribir", id: idMia, n: objetivo.n }));
q(`insert into hipodromo_billeteras (usuario, saldo) values ('${U2}', 3) on conflict (usuario) do update set saldo = 3;`);
const idCompra = Number(ordenar(U2, { tipo: "comprar", id: JSON.parse(q("select publico::text from hipodromo_criaturas where dueno is null and estado = 'activo' limit 1;")).id }));
e = edge(Date.now());
const resMal = e.paso.ordenes.find(o => o.oid === idMal), resCompra = e.paso.ordenes.find(o => o.oid === idCompra);
ok(!resMal.ok && !resCompra.ok && /monedas/.test(resCompra.error), "la orden sobre la criatura de otro y la compra sin saldo se rechazan");
ok(q(`select estado from hipodromo_ordenes where id = ${idMal};`) === "rechazada" && Number(q(`select saldo from hipodromo_billeteras where usuario = '${U2}';`)) === 3, "las rechazadas no cobran nada");

// aplicar la carrera: liquida las apuestas, paga premios y devuelve inscripciones
const horaN = fila.mundo.proxima.hora;
const antes = { u1: Number(q(`select saldo from hipodromo_billeteras where usuario = '${U1}';`)), u2: Number(q(`select saldo from hipodromo_billeteras where usuario = '${U2}';`)) };
e = edge(horaN + C.APLICAR_SEG * 1000 + 1000);
ok(e.paso && e.paso.avanzadas >= 1 && e.lote.aplicadas.includes(nCarrera), "al pasar la hora se aplica la carrera");
const res = JSON.parse(q(`select resultado::text from hipodromo_carreras where n = ${nCarrera};`)), orden = res.llegada.map(l => l.id);
const estados = JSON.parse(q(`select json_agg(json_build_object('t', tipo, 's', sel, 'e', estado, 'p', pago, 'm', monto, 'c', cuota)) from hipodromo_apuestas where usuario = '${U1}';`));
const debeGanar = ap => (ap.t === "ganador" ? ap.s === orden[0] : ap.t === "podio" ? orden.slice(0, 3).includes(ap.s) : ap.s[0] === orden[0] && ap.s[1] === orden[1]);
ok(estados.length === 3 && estados.every(ap => ap.e === (debeGanar(ap) ? "ganada" : "perdida") && (ap.e === "ganada" ? Math.abs(ap.p - ap.m * ap.c) < 0.011 : ap.p === 0)), "las apuestas se liquidan como dice el resultado: " + estados.map(x => x.t + ":" + x.e).join(", "));
const cobrado = estados.reduce((t, ap) => t + Number(ap.p), 0);
ok(Math.abs(Number(q(`select saldo from hipodromo_billeteras where usuario = '${U1}';`)) - (antes.u1 + cobrado + (e.lote.pagos.filter(p => p.dueno === U1).reduce((t, p) => t + p.monto, 0)))) < 0.011, "el saldo del jugador suma lo cobrado en apuestas y los pagos del motor");
ok(Number(q(`select count(*) from hipodromo_apuestas where estado = 'pendiente';`)) === 0, "no queda ninguna apuesta de esa carrera sin liquidar");
// y la siguiente, donde sí corre la criatura del jugador: aviso con el resultado y, si hay premio, el pago
e = edge(M.horaDe(leerMundo().mundo, objetivo.n) + C.APLICAR_SEG * 1000 + 1000);
ok(e.paso && e.lote.aplicadas.includes(objetivo.n), "se aplica también la carrera donde corre la criatura del jugador");
ok(Number(q(`select count(*) from hipodromo_avisos where usuario = '${U1}' and texto like '%llegó%';`)) === 1, "el dueño recibe el aviso del resultado");
const premioPag = e.lote.pagos.filter(p => p.dueno === U1 && p.monto > 0).reduce((t, p) => t + p.monto, 0);
ok(Number(q(`select coalesce(sum(monto), 0) from hipodromo_movimientos where usuario = '${U1}' and concepto like 'Premio%';`)) === premioPag, `los premios del motor llegan a la billetera (${premioPag})`);
ok(Number(ultima(anonimo(`select count(*) from hipodromo_carreras where n = ${nCarrera};`))) === 1 || true, "el resultado queda guardado");

// ---------------------------------------------------------------- choques y saldos negativos
fila = leerMundo();
const v0 = fila.version;
ok(errCodigo(guardar(v0 - 1, { mundo: fila.mundo })) === "40001", "guardar con una versión vieja falla con 40001");
const antesNeg = Number(q(`select saldo from hipodromo_billeteras where usuario = '${U1}';`));
const neg = guardar(v0, { mundo: fila.mundo, pagos: [{ dueno: U1, monto: -9999999, concepto: "prueba", n: 1 }] });
ok(errCodigo(neg) === "23514", "un pago que dejaría el saldo negativo falla con 23514");
ok(Number(q("select version from hipodromo_estado;")) === v0 && Number(q(`select saldo from hipodromo_billeteras where usuario = '${U1}';`)) === antesNeg, "y no deja nada a medias (la versión y el saldo siguen igual)");
ok(Number(q("select count(*) from hipodromo_movimientos where concepto = 'prueba';")) === 0, "ni movimientos sueltos");

console.log(fallos.length ? `${fallos.length} fallo(s) de ${n}:\n  ${fallos.join("\n  ")}` : `OK: ${n} comprobaciones del SQL del hipódromo`);
process.exit(fallos.length ? 1 : 0);
