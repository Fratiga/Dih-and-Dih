// Sube los MP3 nuevos (necesita la regla temporal tmp_recomp_ins) o borra los originales (tmp_recomp_del).
// Uso: node subir.mjs subir | node subir.mjs borrar
import fs from "node:fs";
import path from "node:path";

const URL_SB = "https://ilicqboqelrjuvtslaxd.supabase.co";
const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";   // la clave pública que ya usa el sitio
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const res = JSON.parse(fs.readFileSync(path.join(DIR, "resultados.json"), "utf8")).filter(r => r.vale);
const modo = process.argv[2];
const enc = n => n.split("/").map(encodeURIComponent).join("/");
let bien = 0, mal = 0;

if (modo === "subir") {
  for (const r of res) {
    const cuerpo = fs.readFileSync(path.join(DIR, "out", r.bucket, r.nuevo));
    const x = await fetch(`${URL_SB}/storage/v1/object/${r.bucket}/${enc(r.nuevo)}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "audio/mpeg", "cache-control": "max-age=31536000", "x-upsert": "false" },
      body: cuerpo
    });
    const t = await x.text();
    if (x.ok || /already exists|Duplicate/i.test(t)) bien++; else { mal++; console.log("ERROR", x.status, r.nuevo, t.slice(0, 200)); }
  }
} else if (modo === "borrar") {
  for (const bucket of ["musica_fondos", "tablero"]) {
    const nombres = res.filter(r => r.bucket === bucket).map(r => r.nombre);
    if (!nombres.length) continue;
    const x = await fetch(`${URL_SB}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: nombres })
    });
    const j = await x.json().catch(() => null);
    const n = Array.isArray(j) ? j.length : 0;
    bien += n; mal += nombres.length - n;
    console.log(bucket, x.status, `borrados ${n}/${nombres.length}`);
  }
}
console.log(`${modo}: ${bien} bien, ${mal} mal`);
