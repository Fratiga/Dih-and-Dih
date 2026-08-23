(function () {
  const addBtn = document.getElementById("adminAddBtn");
  const modal = document.getElementById("adminFormModal");
  if (!addBtn || !modal) return;

  const closeBtn = document.getElementById("adminFormClose");
  const form = document.getElementById("adminCharForm");
  const nombreInput = document.getElementById("afNombre");
  const idInput = document.getElementById("afId");
  const relacionesList = document.getElementById("afRelacionesList");
  const habilidadesList = document.getElementById("afHabilidadesList");
  const outputWrap = document.getElementById("afOutputWrap");
  const output = document.getElementById("afOutput");

  addBtn.addEventListener("click", () => modal.showModal());
  closeBtn.addEventListener("click", () => modal.close());
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });

  let idEditadoManualmente = false;
  idInput.addEventListener("input", () => { idEditadoManualmente = true; });

  function slugify(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  nombreInput.addEventListener("input", () => {
    if (!idEditadoManualmente) idInput.value = slugify(nombreInput.value);
  });

  function addRepeatRow(list, template) {
    const row = document.createElement("div");
    row.className = "admin-form-repeat-row";
    row.innerHTML = template;
    row.querySelector(".af-row-remove").addEventListener("click", () => row.remove());
    list.appendChild(row);
    return row;
  }

  document.getElementById("afAddRelacion").addEventListener("click", () => {
    addRepeatRow(relacionesList, `
      <input type="text" placeholder="id (ej: ocevat)" class="af-rel-id">
      <input type="text" placeholder="nota (ej: Fue su maestro)" class="af-rel-nota">
      <button type="button" class="af-row-remove" title="Quitar">×</button>
    `);
  });

  document.getElementById("afAddHabilidad").addEventListener("click", () => {
    addRepeatRow(habilidadesList, `
      <input type="text" placeholder="nombre (ej: Golpe certero)" class="af-hab-nombre">
      <input type="text" placeholder="descripción" class="af-hab-desc">
      <button type="button" class="af-row-remove" title="Quitar">×</button>
    `);
  });

  function escStr(s) {
    return (s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function escTemplate(s) {
    return (s || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  }
  function wrapText(text, width) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    for (const w of words) {
      const candidate = current ? current + " " + w : w;
      if (candidate.length > width && current) {
        lines.push(current);
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
  function buildParagraphBlock(raw, indent) {
    const paragraphs = raw.split(/\n\s*\n/).map(p => p.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (!paragraphs.length) return "``";
    const closeIndent = indent.slice(0, -2);
    const blocks = paragraphs.map(p => {
      const lines = wrapText(escTemplate(p), 74);
      lines[0] = "<p>" + lines[0];
      lines[lines.length - 1] += "</p>";
      return lines.map(l => indent + l).join("\n");
    });
    return "`\n" + blocks.join("\n\n") + "\n" + closeIndent + "`";
  }

  document.getElementById("afGenerar").addEventListener("click", () => {
    const nombre = nombreInput.value.trim();
    const id = idInput.value.trim() || slugify(nombre);
    if (!nombre || !id) {
      alert("Falta el nombre del personaje.");
      return;
    }

    const ladoA = document.getElementById("afLadoA").checked;
    const ladoB = document.getElementById("afLadoB").checked;
    const lado = [...(ladoA ? ["A"] : []), ...(ladoB ? ["B"] : [])];
    if (!lado.length) {
      alert("Elegí al menos un lado.");
      return;
    }

    const contentRaw = document.getElementById("afContent").value.trim();
    if (!contentRaw) {
      alert("Falta el contenido del personaje.");
      return;
    }

    const tipo = document.getElementById("afTipo").value;
    const raza = document.getElementById("afRaza").value.trim();
    const titulo = document.getElementById("afTitulo").value.trim();
    const ocupacion = document.getElementById("afOcupacion").value.trim();
    const faccion = document.getElementById("afFaccion").value.trim();
    const lugarOrigen = document.getElementById("afLugarOrigen").value.trim();
    const primeraAparicion = document.getElementById("afPrimeraAparicion").value.trim();
    const tagsRaw = document.getElementById("afTags").value.trim();
    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
    const summary = document.getElementById("afSummary").value.trim();
    const datosGMRaw = document.getElementById("afDatosGM").value.trim();

    const relaciones = [...relacionesList.querySelectorAll(".admin-form-repeat-row")]
      .map(row => ({
        id: row.querySelector(".af-rel-id").value.trim(),
        nota: row.querySelector(".af-rel-nota").value.trim()
      }))
      .filter(r => r.id);

    const habilidades = [...habilidadesList.querySelectorAll(".admin-form-repeat-row")]
      .map(row => ({
        nombre: row.querySelector(".af-hab-nombre").value.trim(),
        descripcion: row.querySelector(".af-hab-desc").value.trim()
      }))
      .filter(h => h.nombre);

    const lines = [];
    lines.push("  {");
    lines.push(`    id: "${escStr(id)}",`);
    lines.push(`    title: "${escStr(nombre)}",`);
    lines.push(`    category: "Personajes",`);
    lines.push(`    tags: [${tags.map(t => `"${escStr(t)}"`).join(", ")}],`);
    lines.push(`    summary: "${escStr(summary)}",`);
    lines.push(`    retrato: "",`);
    lines.push(`    titulo: "${escStr(titulo)}",`);
    lines.push(`    raza: "${escStr(raza)}",`);
    lines.push(`    tipo: "${escStr(tipo)}",`);
    lines.push(`    lugarOrigen: "${escStr(lugarOrigen)}",`);
    lines.push(`    ocupacion: "${escStr(ocupacion)}",`);
    lines.push(`    faccion: "${escStr(faccion)}",`);
    lines.push(`    primeraAparicion: "${escStr(primeraAparicion)}",`);
    lines.push(`    lado: [${lado.map(l => `"${l}"`).join(", ")}],`);

    if (relaciones.length) {
      lines.push(`    relacionesConocidas: [`);
      relaciones.forEach((r, i) => {
        const comma = i < relaciones.length - 1 ? "," : "";
        lines.push(`      { id: "${escStr(r.id)}", nota: "${escStr(r.nota)}" }${comma}`);
      });
      lines.push(`    ],`);
    } else {
      lines.push(`    relacionesConocidas: [],`);
    }

    if (habilidades.length) {
      lines.push(`    habilidades: [`);
      habilidades.forEach((h, i) => {
        const comma = i < habilidades.length - 1 ? "," : "";
        lines.push(`      { nombre: "${escStr(h.nombre)}", descripcion: "${escStr(h.descripcion)}" }${comma}`);
      });
      lines.push(`    ],`);
    }

    const tieneGM = !!datosGMRaw;
    lines.push(`    content: ${buildParagraphBlock(contentRaw, "      ")}${tieneGM ? "," : ""}`);
    if (tieneGM) {
      lines.push(`    datosGM: ${buildParagraphBlock(datosGMRaw, "      ")}`);
    }
    lines.push("  },");

    output.value = lines.join("\n");
    outputWrap.classList.remove("hidden");
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  document.getElementById("afCopiar").addEventListener("click", () => {
    output.select();
    const btn = document.getElementById("afCopiar");
    const original = btn.textContent;
    navigator.clipboard.writeText(output.value)
      .then(() => { btn.textContent = "¡Copiado!"; })
      .catch(() => { document.execCommand("copy"); btn.textContent = "¡Copiado!"; })
      .finally(() => { setTimeout(() => { btn.textContent = original; }, 1500); });
  });

  document.getElementById("afLimpiar").addEventListener("click", () => {
    form.reset();
    relacionesList.innerHTML = "";
    habilidadesList.innerHTML = "";
    idEditadoManualmente = false;
    outputWrap.classList.add("hidden");
  });
})();
