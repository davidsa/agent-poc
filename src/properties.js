const fs = require("node:fs/promises");
const path = require("node:path");

const PROPERTIES_DIR = path.join(__dirname, "..", "data", "properties");

// Lee el bloque "clave: valor" entre los dos "---" iniciales del archivo.
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return Object.fromEntries(
    match[1].split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
}

async function listIds() {
  const files = await fs.readdir(PROPERTIES_DIR);
  return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
}

async function listProperties() {
  const ids = await listIds();
  return Promise.all(
    ids.map(async (id) => {
      const text = await fs.readFile(path.join(PROPERTIES_DIR, `${id}.md`), "utf8");
      return { id, ...parseFrontmatter(text) };
    }),
  );
}

// Devuelve el markdown completo, o null si el id no existe en el catálogo.
// Se valida contra la lista de archivos para que el id no pueda salir del directorio.
async function getProperty(id) {
  if (!(await listIds()).includes(id)) return null;
  return fs.readFile(path.join(PROPERTIES_DIR, `${id}.md`), "utf8");
}

module.exports = { listProperties, getProperty };
