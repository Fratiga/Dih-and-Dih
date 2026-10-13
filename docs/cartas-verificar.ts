// Edge Function «cartas-verificar» de Supabase (Deno). BORRADOR SIN DESPLEGAR.
//
// Qué hace: comprueba una partida de Triunfos con apuesta volviéndola a jugar con el mismo motor que usan los navegadores.
// El motor es determinista (semilla + mazos + cartas guardadas + lista de acciones dan siempre la misma partida) y una acción
// ilegal se ignora igual en todos lados, así que el registro de acciones decide quién ganó. Lo que cada jugador «avise» solo es
// una pista. Con el veredicto llama a cartas_i_aplicar_verificacion (docs/economia-10_verificacion.sql), que reparte las cartas
// una sola vez, anota a quien avisó algo falso y deja constancia.
//   * Partida terminada según el registro  -> se cierra con ese resultado (motivo «verificada»).
//   * Quien tiene que actuar lleva más de «apuesta_turno_horas» sin hacerlo -> pierde por abandono (motivo «abandono»).
//   * Cualquier otra cosa (sigue en juego, error) -> no cambia nada; valen las reglas de tiempo de economia_7.
//
// Quién la puede llamar: los dos jugadores de la partida y el admin (con su sesión). Es idempotente: llamarla de más no mueve
// ninguna carta. El admin puede pasar { "aplicar": false } para ver el veredicto sin aplicarlo.
//
// Preparación (una sola vez):
//   * Aplicar docs/economia-10_verificacion.sql.
//   * Crear la función:  supabase functions new cartas-verificar  y poner este archivo como index.ts.
//   * Un archivo ventana.ts con una sola línea:  (globalThis as any).window = globalThis;   (los archivos del motor son
//     scripts de navegador y esperan `window`; se importa primero, antes que ellos).
//   * Cambiar <HASH> de abajo por el hash de un commit del repositorio Fratiga/Dih-and-Dih que tenga estos cuatro archivos tal
//     como están publicados. Los imports tienen que ser estáticos y de una versión FIJA. IMPORTANTE: cuando cambies
//     js/cartas-motor.js, js/cartas-efectos.js o js/cartas-vinculos.js, actualiza el hash aquí; si no, la función volvería a jugar
//     las partidas con reglas distintas a las que vieron los jugadores.
//   * Desplegar con la comprobación de sesión puesta (es lo por defecto):  supabase functions deploy cartas-verificar
//     (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase).
//   * Probar antes con:  node tools/probar-verificacion.js  (el mismo código del veredicto contra 120 partidas al azar).

import "./ventana.ts";
import "https://cdn.jsdelivr.net/gh/Fratiga/Dih-and-Dih@<HASH>/js/cartas-motor.js";
import "https://cdn.jsdelivr.net/gh/Fratiga/Dih-and-Dih@<HASH>/js/cartas-efectos.js";
import "https://cdn.jsdelivr.net/gh/Fratiga/Dih-and-Dih@<HASH>/js/cartas-vinculos.js";
import "https://cdn.jsdelivr.net/gh/Fratiga/Dih-and-Dih@<HASH>/js/cartas-verificar.js";

const MOTOR = "<HASH>";
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// deno-lint-ignore no-explicit-any
const g = globalThis as any;

const CABECERAS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const responder = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });

async function rest(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...init,
    headers: { apikey: CLAVE_SERVICIO, Authorization: `Bearer ${CLAVE_SERVICIO}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECERAS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  // Quién llama (la sesión del jugador)
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
  const quien = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: CLAVE_ANON, Authorization: `Bearer ${token}` } });
  if (!quien.ok) return responder({ error: "Hay que iniciar sesión" }, 401);
  const usuario = await quien.json();

  let cuerpo: { partida?: string; aplicar?: boolean };
  try { cuerpo = await req.json(); } catch { return responder({ error: "Cuerpo inválido" }, 400); }
  const id = String(cuerpo.partida || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return responder({ error: "Partida inválida" }, 400);

  try {
    const filas = await rest(`cartas_partidas?id=eq.${id}&select=*`);
    const fila = filas[0];
    if (!fila) return responder({ error: "Partida no encontrada" }, 404);
    const admin = (await rest(`fichas_admins?user_id=eq.${usuario.id}&select=user_id`)).length > 0;
    if (usuario.id !== fila.j1 && usuario.id !== fila.j2 && !admin) return responder({ error: "No es tu partida" }, 403);
    const aplicar = cuerpo.aplicar !== false || !admin;   // solo el admin puede pedir ver sin aplicar

    if ((fila.estado !== "en_curso" && fila.estado !== "disputa") || fila.apuesta_estado !== "activa") {
      return responder({ estado: "nada", mensaje: "La partida no está abierta con apuesta" });
    }

    // Los vínculos que hay guardados en el servidor cambian las reglas del combate: se aplican igual que en el navegador
    g.aplicarVinculosServidor(await rest("cartas_vinculos?select=id,tipo,data,borrado"));
    const ajuste = await rest("cartas_economia_ajustes?clave=eq.apuesta_turno_horas&select=valor");
    const horasTurno = Number(ajuste[0]?.valor ?? 48) || 0;

    const veredicto = g.CartasVerificar.analizar(fila, g.CartasMotor, { horasTurno });
    const falsos = g.CartasVerificar.avisosFalsos(fila, veredicto);
    if (veredicto.estado !== "terminada" && veredicto.estado !== "abandono") return responder({ ...veredicto, aplicado: false });
    if (!aplicar) return responder({ ...veredicto, avisosFalsos: falsos, aplicado: false });

    const detalle = veredicto.estado === "abandono"
      ? `Quien tenía que actuar llevaba ${veredicto.horas} h sin hacerlo (plazo ${horasTurno} h). Motor ${MOTOR}`
      : `Repetida la partida: ${veredicto.acciones} acciones, ${veredicto.ignoradas} ignoradas, fin por ${veredicto.motivo}. Motor ${MOTOR}`;
    const resultado = await rest("rpc/cartas_i_aplicar_verificacion", {
      method: "POST",
      body: JSON.stringify({ p_id: id, p_resultado: veredicto.resultado, p_motivo: veredicto.estado === "abandono" ? "abandono" : "verificada", p_detalle: detalle }),
    });
    return responder({ ...veredicto, avisosFalsos: falsos, aplicado: resultado === "resuelta" });
  } catch (e) {
    return responder({ error: String((e as Error).message || e) }, 500);
  }
});
