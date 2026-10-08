// Edge Function «hipodromo-avanzar» de Supabase (Deno). Referencia: no se ha podido ejecutar desde aquí.
//
// Qué hace, cada vez que se la llama (una vez por minuto basta, es idempotente):
//   1. Lee el mundo guardado en hipodromo_estado (o nada, la primera vez).
//   2. Se lo pasa a HipodromoMotor.paso(), que decide si hay que crear el mundo, ponerlo al día o no hacer nada.
//   3. Guarda el resultado con la función SQL hipodromo_guardar, que comprueba la versión: si otra llamada se
//      adelantó, falla con 40001 y aquí se vuelve a leer y a intentar.
//
// Preparación (una sola vez):
//   * Ejecutar docs/hipodromo.sql en el editor SQL.
//   * Crear la función:  supabase functions new hipodromo-avanzar  y poner este archivo como index.ts.
//   * Copiar al lado de index.ts, SIN cambiarlos, estos tres archivos del sitio:
//       data/hipodromo-palabras.js   js/hipodromo-nombres.js   js/hipodromo-motor.js
//   * Secretos:  supabase secrets set HIPODROMO_CLAVE=<una clave larga al azar> HIPODROMO_SEMILLA=<cualquier texto>
//     (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase). La semilla solo importa la primera vez.
//   * Desplegar sin comprobar JWT, porque la llamada lleva su propia clave:
//       supabase functions deploy hipodromo-avanzar --no-verify-jwt
//   * Programar la llamada (extensiones pg_cron y pg_net activadas en Database > Extensions):
//       select cron.schedule('hipodromo-avanzar', '* * * * *', $$
//         select net.http_post(
//           url     := 'https://<PROYECTO>.supabase.co/functions/v1/hipodromo-avanzar',
//           headers := jsonb_build_object('Content-Type', 'application/json', 'x-hipodromo-clave', '<LA MISMA CLAVE>'),
//           body    := '{}'::jsonb) $$);
//
// La primera ejecución crea el mundo con 300 carreras de historia previa y fija la primera carrera en vivo en la
// próxima media hora redonda que quede a más de 5 minutos. Para empezar de cero: vaciar las tablas hipodromo_*.

import { createClient } from "npm:@supabase/supabase-js@2";

// Los archivos del motor son scripts de navegador: esperan una variable global `window`.
(globalThis as any).window = globalThis;
await import("./hipodromo-palabras.js");
await import("./hipodromo-nombres.js");
await import("./hipodromo-motor.js");
const Motor = (globalThis as any).HipodromoMotor;

const respuesta = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-hipodromo-clave") !== Deno.env.get("HIPODROMO_CLAVE")) return respuesta(401, { error: "clave" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const cfg = { semilla: Deno.env.get("HIPODROMO_SEMILLA") ?? "hipodromo", max: 48 };

  for (let intento = 0; intento < 3; intento++) {
    const { data: fila, error: errLeer } = await sb.from("hipodromo_estado").select("version, mundo").eq("id", 1).maybeSingle();
    if (errLeer) return respuesta(500, { error: errLeer.message });

    const paso = Motor.paso(fila, Date.now(), cfg);
    if (!paso) return respuesta(200, { avanzadas: 0 });

    const { data: version, error } = await sb.rpc("hipodromo_guardar", { p_version: paso.version, p_lote: paso.lote });
    if (error && error.code === "40001") continue;                 // otra ejecución se adelantó: releer y repetir
    if (error) return respuesta(500, { error: error.message });
    return respuesta(200, { avanzadas: paso.avanzadas, version, carrera: paso.lote.mundo.n });
  }
  return respuesta(409, { error: "demasiados choques de versión" });
});
