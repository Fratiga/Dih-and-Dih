// Edge Function «hipodromo-avanzar» de Supabase (Deno).
//
// Qué hace, cada vez que se la llama (una vez por minuto basta, es idempotente):
//   1. Lee el mundo guardado en hipodromo_estado (o nada, la primera vez).
//   2. Lee las órdenes pendientes de los jugadores (hipodromo_ordenes) y el saldo de quien las mandó.
//   3. Se lo pasa todo a HipodromoMotor.paso(), que decide si hay que crear el mundo, aplicar las órdenes (cuánto cuestan y
//      si valen), ponerlo al día con las carreras que ya tocan o no hacer nada.
//   4. Guarda el resultado con la función SQL hipodromo_guardar, que comprueba la versión: si otra llamada se adelantó,
//      falla con 23514 (no con 40001: PostgREST reintenta sin fin ese código) y aquí se vuelve a leer y a intentar. Si un pago dejaría un saldo negativo (alguien apostó entre
//      la lectura y el guardado) falla con 23514 y también se repite con los saldos nuevos. En la misma transacción se
//      cobran las órdenes, se pagan los premios y se liquidan las apuestas de las carreras que se aplican.
//
// Preparación (una sola vez):
//   * Ejecutar docs/hipodromo.sql en el editor SQL.
//   * Crear la función:  supabase functions new hipodromo-avanzar  y poner este archivo como index.ts.
//   * El motor: o se copian al lado de index.ts, SIN cambiarlos, estos cinco archivos del sitio
//       data/hipodromo-palabras.js   js/hipodromo-nombres.js   js/hipodromo-rasgos.js   js/hipodromo-npc.js   js/hipodromo-motor.js
//     (desde la versión 10 se hace así: jsDelivr ya no sirve commits nuevos del repositorio porque pasa de sus 50 MB)
//     o (lo que se hizo hasta la versión 9) se cambian las cinco líneas «import "./...js"» de abajo por
//     la dirección de una versión FIJA del repositorio, con el hash del commit, que nunca cambia:
//       import "https://cdn.jsdelivr.net/gh/Fratiga/Dih-and-Dih@<hash-del-commit>/js/hipodromo-motor.js";
//     (los imports tienen que ser estáticos: la Edge Function no admite import() dinámico de direcciones web).
//     Cambiar de commit cambia las reglas del mundo en marcha: hazlo solo a propósito y repitiendo tools/probar-hipodromo.js.
//   * Un archivo ventana.ts con una sola línea:  (globalThis as any).window = globalThis;   (los archivos del motor son
//     scripts de navegador y esperan `window`; se importa primero, antes que ellos).
//   * Secretos:  supabase secrets set HIPODROMO_CLAVE=<una clave larga al azar> HIPODROMO_SEMILLA=<cualquier texto>
//     (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase). La semilla solo importa la primera vez y
//     tiene que ser secreta: con ella se podría adivinar el tiempo de las carreras futuras.
//   * Desplegar sin comprobar JWT, porque la llamada lleva su propia clave:
//       supabase functions deploy hipodromo-avanzar --no-verify-jwt
//   * Programar la llamada (extensiones pg_cron y pg_net activadas en Database > Extensions):
//       select cron.schedule('hipodromo-avanzar', '* * * * *', $$
//         select net.http_post(
//           url     := 'https://<PROYECTO>.supabase.co/functions/v1/hipodromo-avanzar',
//           headers := jsonb_build_object('Content-Type', 'application/json', 'x-hipodromo-clave', '<LA MISMA CLAVE>'),
//           body    := '{}'::jsonb) $$);
//
// La primera ejecución crea el mundo, con 300 carreras de historia que las siguientes ejecuciones van viviendo (20 por minuto), y fija la primera carrera en vivo en la
// próxima media hora redonda que quede a más de 5 minutos. Para empezar de cero: vaciar las tablas hipodromo_*.

import { createClient } from "npm:@supabase/supabase-js@2";

// Los archivos del motor son scripts de navegador: esperan una variable global `window` (la pone ventana.ts, que va primero).
import "./ventana.ts";
import "./hipodromo-palabras.js";
import "./hipodromo-nombres.js";
import "./hipodromo-rasgos.js";
import "./hipodromo-npc.js";      // los personajes del mundo (cuadras y apostadores); va antes que el motor
import "./hipodromo-motor.js";
const Motor = (globalThis as any).HipodromoMotor;

const vacio = { data: [] as any[], error: null };
const respuesta = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-hipodromo-clave") !== Deno.env.get("HIPODROMO_CLAVE")) return respuesta(401, { error: "clave" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Una Edge Function no puede gastar mucho tiempo de cálculo de una vez: el mundo se crea con 300 carreras de historia por vivir
  // y se pone al día de 20 en 20 en las llamadas siguientes (las que quedan atrás se programan con pocas simulaciones).
  const cfg = { semilla: Deno.env.get("HIPODROMO_SEMILLA") ?? "hipodromo", historia: 300, max: 20, rapido: 12 };

  for (let intento = 0; intento < 4; intento++) {
    // Todo lo que hace falta leer, a la vez: cada consulta por separado costaba unos 0,3 s y las órdenes de la cuadra esperaban esa suma.
    // El mundo, las órdenes de los jugadores y, del Admin, los ajustes de los personajes y sus órdenes (si esas tablas todavía no existen, se sigue sin ellas).
    const [rEstado, rOrd, rAj, rNpcOrd] = await Promise.all([
      sb.from("hipodromo_estado").select("version, mundo").eq("id", 1).maybeSingle(),
      sb.from("hipodromo_ordenes").select("id, datos").eq("estado", "pendiente").order("id").limit(60),
      sb.from("hipodromo_npc_ajustes").select("clave, datos"),
      sb.from("hipodromo_npc_ordenes").select("id, datos").eq("estado", "pendiente").order("id").limit(40)
    ]);
    if (rEstado.error) return respuesta(500, { error: rEstado.error.message });
    if (rOrd.error) return respuesta(500, { error: rOrd.error.message });
    const fila = rEstado.data;
    const ordenes = (rOrd.data ?? []).map((o: any) => ({ ...o.datos, oid: o.id }));
    const duenos = [...new Set(ordenes.map((o: any) => o.dueno))];

    // y, con lo anterior ya a mano, lo que dependía de ello: lo que tiene en la billetera quien mandó órdenes y lo que han apostado los jugadores al pozo de la carrera que se va a aplicar
    const [rBill, rPozo] = await Promise.all([
      duenos.length ? sb.from("hipodromo_billeteras").select("usuario, saldo").in("usuario", duenos) : Promise.resolve(vacio),
      fila ? sb.from("hipodromo_pozos").select("criatura_id, total").eq("n", fila.mundo.n) : Promise.resolve(vacio)
    ]);
    if (rBill.error) return respuesta(500, { error: rBill.error.message });
    if (rPozo.error) return respuesta(500, { error: rPozo.error.message });
    const saldos: Record<string, number> = {};
    duenos.forEach((d: any) => { saldos[d] = 0; });   // quien aún no tiene billetera empieza con 0
    (rBill.data ?? []).forEach((b: any) => { saldos[b.usuario] = Number(b.saldo); });
    const pozos: Record<number, Record<number, number>> = {};
    if (fila) { pozos[fila.mundo.n] = {}; (rPozo.data ?? []).forEach((x: any) => { pozos[fila.mundo.n][x.criatura_id] = Number(x.total); }); }
    let npc: any = undefined;
    if (!rAj.error) { npc = { ajustes: {} }; (rAj.data ?? []).forEach((a: any) => { npc.ajustes[a.clave] = a.datos; }); }
    const npcOrdenes: any[] = rNpcOrd.error ? [] : (rNpcOrd.data ?? []).map((o: any) => ({ ...o.datos, id: o.id }));

    const paso = Motor.paso(fila, Date.now(), { ...cfg, ordenes, saldos, pozos, npc, npcOrdenes });
    if (!paso) return respuesta(200, { avanzadas: 0 });

    const { data: version, error } = await sb.rpc("hipodromo_guardar", { p_version: paso.version, p_lote: paso.lote });
    if (error && (error.code === "40001" || error.code === "23514")) continue;   // otra ejecución se adelantó o cambió un saldo: releer y repetir
    if (error) return respuesta(500, { error: error.message });
    // el resultado de cada orden del Admin (el motor apunta hasta cuál llegó, así que si esto fallara no se repetirían)
    for (const r of (paso.lote.npcOrdenes ?? [])) {
      await sb.from("hipodromo_npc_ordenes").update({ estado: r.ok ? "hecha" : "rechazada", texto: (r.ok ? r.texto : r.error) ?? "", resuelta: new Date().toISOString() }).eq("id", r.oid).eq("estado", "pendiente");
    }
    return respuesta(200, { avanzadas: paso.avanzadas, ordenes: (paso.ordenes ?? []).length, version, carrera: paso.lote.mundo.n });
  }
  return respuesta(409, { error: "demasiados choques de versión" });
});
