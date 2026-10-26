// Registra (o actualiza) los comandos slash del bot «The great mice» en Discord. Se corre desde tu ordenador, no desde la web:
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... node docs/discord/registrar.js
// (o con un archivo .env cargado: node --env-file=docs/discord/.env docs/discord/registrar.js)
// Con DISCORD_GUILD_ID los comandos solo existen en tu servidor y aparecen al instante. Sin él serían globales y tardan en propagarse.
// Reemplaza TODOS los comandos de la aplicación por los de comandos.js: lo que quites de allí desaparece de Discord. El token no se imprime.

import { COMANDOS } from "./comandos.js";

const { DISCORD_APP_ID: app, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: servidor } = process.env;
if (!app || !token) {
  console.error("Faltan DISCORD_APP_ID o DISCORD_BOT_TOKEN (mira docs/discord/.env.example).");
  process.exit(1);
}
const url = `https://discord.com/api/v10/applications/${app}/${servidor ? `guilds/${servidor}/` : ""}commands`;
const r = await fetch(url, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json", "User-Agent": "TheGreatMice (registrar, 1.0)" },
  body: JSON.stringify(COMANDOS)
});
const texto = await r.text();
if (!r.ok) {
  console.error(`Discord respondió ${r.status}:`, texto.slice(0, 600));
  process.exit(1);
}
const lista = JSON.parse(texto);
console.log(`Listo: ${lista.length} comandos registrados ${servidor ? "en el servidor " + servidor : "de forma global"}:`);
for (const c of lista) console.log(`  /${c.name}`);
