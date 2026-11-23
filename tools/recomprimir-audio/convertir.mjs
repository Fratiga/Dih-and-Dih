// Baja cada archivo del plan, guarda el original en el respaldo y lo codifica a MP3 128 kbps.
// Uso: node convertir.mjs   (reanudable: salta lo que ya existe)
import fs from "node:fs";
import path from "node:path";
import decode from "audio-decode";
import { Mp3Encoder } from "@breezystack/lamejs";

const BASE = "https://ilicqboqelrjuvtslaxd.supabase.co/storage/v1/object/public";
const RESPALDO = process.env.RESPALDO || path.join(process.env.USERPROFILE || ".", "respaldo-audio-supabase");
const SALIDA = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"), "out");
const plan = JSON.parse(fs.readFileSync(new URL("./plan.json", import.meta.url), "utf8"));
const nuevoNombre = n => n.replace(/\.(mp3|flac)$/i, "") + "-128k.mp3";
const resultados = [];

function codificar(ab) {
  const canales = Math.min(2, ab.numberOfChannels);
  const enc = new Mp3Encoder(canales, ab.sampleRate, 128);
  const datos = [0, 1].slice(0, canales).map(c => ab.getChannelData(c));
  const aInt = f => { const r = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); r[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return r; };
  const ints = datos.map(aInt);
  const partes = [];
  const BLOQUE = 1152 * 20;
  for (let i = 0; i < ints[0].length; i += BLOQUE) {
    const l = ints[0].subarray(i, i + BLOQUE);
    const buf = canales === 2 ? enc.encodeBuffer(l, ints[1].subarray(i, i + BLOQUE)) : enc.encodeBuffer(l);
    if (buf.length) partes.push(Buffer.from(buf));
  }
  const fin = enc.flush();
  if (fin.length) partes.push(Buffer.from(fin));
  return Buffer.concat(partes);
}

for (const [bucket, nombre, tam] of plan) {
  const orig = path.join(RESPALDO, bucket, nombre);
  const dest = path.join(SALIDA, bucket, nuevoNombre(nombre));
  fs.mkdirSync(path.dirname(orig), { recursive: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    if (!fs.existsSync(orig) || fs.statSync(orig).size !== tam) {
      const r = await fetch(`${BASE}/${bucket}/${nombre.split("/").map(encodeURIComponent).join("/")}`);
      if (r.status !== 200) throw new Error(`bajada ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length !== tam) throw new Error(`tamaño ${b.length} != ${tam}`);
      fs.writeFileSync(orig, b);
    }
    const d = await decode(fs.readFileSync(orig));
    const cd = d.channelData || [];
    if (!cd.length || !cd[0].length) throw new Error("no se pudo decodificar");
    const ab = { sampleRate: d.sampleRate, numberOfChannels: cd.length, getChannelData: c => cd[c], duration: cd[0].length / d.sampleRate };
    let mp3;
    if (fs.existsSync(dest)) mp3 = fs.readFileSync(dest);
    else { mp3 = codificar(ab); fs.writeFileSync(dest, mp3); }
    const vale = mp3.length < tam * 0.8;
    resultados.push({ bucket, nombre, nuevo: nuevoNombre(nombre), antes: tam, despues: mp3.length, duracion: ab.duration, hz: ab.sampleRate, canales: ab.numberOfChannels, vale });
    console.log(`${vale ? "OK  " : "SALTA"} ${(tam / 1048576).toFixed(1)} -> ${(mp3.length / 1048576).toFixed(1)} MB  ${ab.duration.toFixed(0)}s ${ab.sampleRate}Hz  ${nombre}`);
  } catch (e) {
    resultados.push({ bucket, nombre, error: String(e.message || e) });
    console.log(`ERROR ${nombre}: ${e.message || e}`);
  }
}
fs.writeFileSync(new URL("./resultados.json", import.meta.url), JSON.stringify(resultados, null, 1));
const ok = resultados.filter(r => r.vale);
console.log(`\n${ok.length}/${plan.length} listos. Antes ${(ok.reduce((a, r) => a + r.antes, 0) / 1048576).toFixed(0)} MB, después ${(ok.reduce((a, r) => a + r.despues, 0) / 1048576).toFixed(0)} MB. Errores: ${resultados.filter(r => r.error).length}`);
