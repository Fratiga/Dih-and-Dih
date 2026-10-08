// Firma el token que usa Claude para leer con el rol claude_lectura (ver docs/claude-lectura.sql).
// El secreto JWT de Supabase NO se pasa por argumentos ni se muestra: se lee de la variable SUPABASE_JWT_SECRET
// de tu propio ordenador. Solo sale el token, que caduca solo, y lo único que permite es lo que permite el rol.
//
// Uso (en tu ordenador, nunca en el chat):
//   Windows (PowerShell):  $env:SUPABASE_JWT_SECRET = "el-secreto"; node tools/firmar-jwt-lectura.js [dias]
//   Mac o Linux:           SUPABASE_JWT_SECRET="el-secreto" node tools/firmar-jwt-lectura.js [dias]
// dias: de 1 a 365 (por defecto 90).
const crypto = require("crypto");
const secreto = process.env.SUPABASE_JWT_SECRET || "";
const dias = Math.max(1, Math.min(365, Number(process.argv[2]) || 90));
if (secreto.length < 32) { console.error("Falta SUPABASE_JWT_SECRET (el secreto JWT del proyecto, de 32 caracteres o más)."); process.exit(1); }
const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const ahora = Math.floor(Date.now() / 1000);
const cuerpo = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ role: "claude_lectura", iss: "supabase", iat: ahora, exp: ahora + dias * 86400 });
const firma = crypto.createHmac("sha256", secreto).update(cuerpo).digest("base64url");
console.error(`Token para el rol claude_lectura, caduca el ${new Date((ahora + dias * 86400) * 1000).toISOString().slice(0, 10)} (${dias} días).`);
console.log(cuerpo + "." + firma);
