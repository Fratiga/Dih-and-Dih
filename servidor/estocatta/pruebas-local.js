"use strict";
/* Servidor de Estocatta para probar en este ordenador, sin Supabase.
   Acepta tokens de prueba con la forma "prueba:<id>:<nombre>" y no anota resultados en
   ninguna base: los escribe en la consola. NUNCA se despliega: el servidor real se arranca
   con `node servidor.js`, que solo acepta sesiones de Supabase.

   node pruebas-local.js            (puerto 8787)
   Después abre estocatta.html?servidor=ws://localhost:8787 y, en la consola del navegador:
   window.fichasSesionActual = async () => ({ access_token: "prueba:ana:Ana", user: { id: "ana" } }) */
const { crearServidor } = require("./servidor.js");

const srv = crearServidor({
  verificar: async token => {
    const m = /^prueba:([a-z0-9]{1,20}):([\wáéíóúñ ]{1,20})$/i.exec(String(token || ""));
    return m ? { id: m[1], nombre: m[2] } : null;
  },
  registrar: async r => { console.log("resultado (no se guarda):", JSON.stringify(r)); return { guardado: true }; },
  log: m => console.log(m)
});
srv.escuchar(Number(process.env.PORT) || 8787).then(p => console.log("Estocatta de pruebas en ws://localhost:" + p));
