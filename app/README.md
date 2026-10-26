# app/

Partes nuevas del compendio que se compilan con Vite, TypeScript y Phaser. Las páginas de la raíz no pasan por aquí y siguen siendo HTML y scripts clásicos.

El sitio se publica en `https://fratiga.github.io/Dih-and-Dih/`, no en la raíz de un dominio, así que todas las rutas del resultado son relativas.

## Comandos (desde `app/`)

```bash
npm install      # solo la primera vez
npm run dev      # servidor de desarrollo
npm run check    # comprueba los tipos
npm run build    # comprueba y compila a app/dist
```

## Publicar

`app/dist` se sube al repositorio. GitHub Pages sigue sirviendo la rama `main` tal cual, sin acciones ni cambios de configuración. Después de cambiar algo en `src/`, hay que ejecutar `npm run build` y subir también `dist/`.

## Qué hay

- `index.html` y `src/main.ts`: la página de la prueba y la entrada de Phaser. Solo la abre el admin, igual que los demás juegos ocultos.
- `src/escenas/Taberna.ts`: una sala explorable con movimiento por teclado o por clic, colisiones, un NPC, una chimenea con luz y una puerta de salida.
- `src/texturas.ts`: los sprites se dibujan en código para no depender de arte. Cuando haya arte, se sustituyen estas claves.
- `src/interfaz.ts`: avisos y diálogos en HTML, para que el texto se vea nítido aunque el juego se escale.
