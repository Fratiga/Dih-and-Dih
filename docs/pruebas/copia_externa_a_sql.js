// Convierte la copia externa de una etapa (JSON, sacada de la base con la consulta de docs/economia-despliegue.md) en un script SQL
// que la vuelve a cargar en el esquema respaldo_economia_20261013, para poder ejecutar después restaurar('<etapa>').
// Uso: node docs/pruebas/copia_externa_a_sql.js respaldos/e0.json e0 > /tmp/cargar_e0.sql
const fs = require("fs");
const [, , ruta, etapa] = process.argv;
if (!ruta || !/^[a-z0-9_]{1,20}$/.test(etapa || "")) { console.error("Uso: node copia_externa_a_sql.js <copia.json> <etapa>"); process.exit(1); }
const c = JSON.parse(fs.readFileSync(ruta, "utf8"));
if (c.formato !== "economia-e0-copia-externa-v1") { console.error("Formato desconocido"); process.exit(1); }
const S = "respaldo_economia_20261013";
const q = (v) => { const tag = "$j" + Math.random().toString(36).slice(2, 8) + "$"; return tag + JSON.stringify(v) + tag; };
const cols = {
  funciones: "firma text, nombre text, def text, acl text, copiado timestamptz",
  politicas: "tabla text, nombre text, permisiva text, roles text, orden text, qual text, with_check text",
  tablas: "tabla text, acl text, rls boolean",
  restricciones: "tabla text, nombre text, def text",
  disparadores: "tabla text, nombre text, def text",
  indices: "tabla text, nombre text, def text",
};
let sql = `begin;\ncreate schema if not exists ${S};\nrevoke all on schema ${S} from public, anon, authenticated;\n`;
for (const [n, def] of Object.entries(cols)) {
  if (!Array.isArray(c.meta[n])) { console.error("Falta " + n); process.exit(1); }
  sql += `create table ${S}.${n}_${etapa} as select * from jsonb_to_recordset(${q(c.meta[n])}::jsonb) as t(${def});\n`;
}
for (const [t, filas] of Object.entries(c.datos)) {
  if (!/^[a-z0-9_]+$/.test(t)) { console.error("Tabla rara: " + t); process.exit(1); }
  sql += `create table ${S}.d_${etapa}_${t} as select * from jsonb_populate_recordset(null::public.${t}, ${q(filas)}::jsonb);\n`;
}
sql += "commit;\n";
process.stdout.write(sql);
