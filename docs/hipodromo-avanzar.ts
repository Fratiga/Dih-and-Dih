// Edge Function «hipodromo-avanzar» de Supabase (Deno).
//
// Qué hace, cada vez que se la llama (una vez por minuto basta, es idempotente):
//   1. Lee el mundo guardado en hipodromo_estado (o nada, la primera vez).
//   2. Lee las órdenes pendientes de los jugadores (hipodromo_ordenes) y el saldo de quien las mandó.
//   3. Se lo pasa todo a HipodromoMotor.paso(), que decide si hay que crear el mundo, aplicar las órdenes (cuánto cuestan y
//      si valen), ponerlo al día con las carreras que ya tocan o no hacer nada.
//   4. Guarda el resultado con la función SQL hipodromo_guardar, que comprueba la versión: si otra llamada se adelantó,
//      falla con 40001 y aquí se vuelve a leer y a intentar. Si un pago dejaría un saldo negativo (alguien apostó entre
//      la lectura y el guardado) falla con 23514 y también se repite con los saldos nuevos. En la misma transacción se
//      cobran las órdenes, se pagan los premios y se liquidan las apuestas de las carreras que se aplican.
//
// Preparación (una sola vez):
//   * Ejecutar docs/hipodromo.sql en el editor SQL.
//   * Crear la función:  supabase functions new hipodromo-avanzar  y poner este archivo como index.ts.
//   * El motor: o se copian al lado de index.ts, SIN cambiarlos, estos cuatro archivos del sitio
//       data/hipodromo-palabras.js   js/hipodromo-nombres.js   js/hipodromo-rasgos.js   js/hipodromo-motor.js
//     o (lo que se hizo al desplegar con el editor de Supabase) se cambian las cuatro líneas «import "./...js"» de abajo por
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
import "./hipodromo-motor.js";
const Motor = (globalThis as any).HipodromoMotor;

const respuesta = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-hipodromo-clave") !== Deno.env.get("HIPODROMO_CLAVE")) return respuesta(401, { error: "clave" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Una Edge Function no puede gastar mucho tiempo de cálculo de una vez: el mundo se crea con 300 carreras de historia por vivir
  // y se pone al día de 20 en 20 en las llamadas siguientes (las que quedan atrás se programan con pocas simulaciones).
  const cfg = { semilla: Deno.env.get("HIPODROMO_SEMILLA") ?? "hipodromo", historia: 300, max: 20, rapido: 12 };

  for (let intento = 0; intento < 4; intento++) {
    const { data: fila, error: errLeer } = await sb.from("hipodromo_estado").select("version, mundo").eq("id", 1).maybeSingle();
    if (errLeer) return respuesta(500, { error: errLeer.message });

    // las órdenes de los jugadores y lo que tiene cada uno en la billetera
    const { data: pend, error: errOrd } = await sb.from("hipodromo_ordenes").select("id, datos").eq("estado", "pendiente").order("id").limit(60);
    if (errOrd) return respuesta(500, { error: errOrd.message });
    const ordenes = (pend ?? []).map((o: any) => ({ ...o.datos, oid: o.id }));
    const saldos: Record<string, number> = {};
    const duenos = [...new Set(ordenes.map((o: any) => o.dueno))];
    if (duenos.length) {
      const { data: bs, error: errB } = await sb.from("hipodromo_billeteras").select("usuario, saldo").in("usuario", duenos);
      if (errB) return respuesta(500, { error: errB.message });
      duenos.forEach((d: any) => { saldos[d] = 0; });   // quien aún no tiene billetera empieza con 0
      (bs ?? []).forEach((b: any) => { saldos[b.usuario] = Number(b.saldo); });
    }

    const paso = Motor.paso(fila, Date.now(), { ...cfg, ordenes, saldos });
    if (!paso) return respuesta(200, { avanzadas: 0 });

    const { data: version, error } = await sb.rpc("hipodromo_guardar", { p_version: paso.version, p_lote: paso.lote });
    if (error && (error.code === "40001" || error.code === "23514")) continue;   // otra ejecución se adelantó o cambió un saldo: releer y repetir
    if (error) return respuesta(500, { error: error.message });
    return respuesta(200, { avanzadas: paso.avanzadas, ordenes: (paso.ordenes ?? []).length, version, carrera: paso.lote.mundo.n });
  }
  return respuesta(409, { error: "demasiados choques de versión" });
});
