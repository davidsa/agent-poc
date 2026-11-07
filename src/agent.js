const Anthropic = require("@anthropic-ai/sdk");
const { listProperties, getProperty } = require("./properties");

const MODEL = "claude-opus-5-5";
const MAX_ITERATIONS = 8;

const SYSTEM_PROMPT = `Eres un asesor inmobiliario. Ayudas al usuario a elegir la propiedad que más le conviene del catálogo.

Cómo trabajar:
- Si el usuario no ha dado presupuesto, zona, número de alcobas y necesidades (mascotas, familia, carro, inversión), pregunta lo esencial antes de recomendar.
- Consulta el catálogo con list_properties y abre el detalle con get_property solo de las candidatas.
- Recomienda de 1 a 3 propiedades, explica por qué encajan y menciona sus desventajas. Incluye la administración mensual al comparar precios.
- Usa únicamente datos del catálogo. Si algo no aparece, dilo; no inventes propiedades ni características.
- Responde en el idioma del usuario, de forma breve y clara.`;

// Lee ANTHROPIC_API_KEY del entorno.
const client = new Anthropic();

const TOOLS = [
  {
    name: "list_properties",
    description:
      "Lista todas las propiedades del catálogo con id, título, tipo, precio en COP, zona, estrato, alcobas, baños, m2 y parqueaderos.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_property",
    description:
      "Devuelve la ficha completa (características, administración, entorno) de una propiedad por su id.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Id de la propiedad, tal como aparece en list_properties",
        },
      },
      required: ["id"],
    },
  },
];

const TOOL_HANDLERS = {
  list_properties: async () => JSON.stringify(await listProperties(), null, 2),
  get_property: async ({ id }) =>
    (await getProperty(id)) ?? `No existe una propiedad con id "${id}".`,
};

async function runTool({ id, name, input }) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { type: "tool_result", tool_use_id: id, content: `Tool desconocida: ${name}`, is_error: true };
  }
  try {
    return { type: "tool_result", tool_use_id: id, content: await handler(input) };
  } catch (err) {
    return { type: "tool_result", tool_use_id: id, content: String(err.message), is_error: true };
  }
}

// `messages` es el historial completo [{ role, content }]; la API no guarda estado.
async function runAgent({ messages }) {
  const history = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: history,
    });

    if (response.stop_reason === "end_turn") {
      const reply = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      return { reply };
    }
    if (response.stop_reason !== "tool_use") {
      throw new Error(`agent stopped: ${response.stop_reason}`);
    }

    // Se devuelve response.content completo (incluye los bloques de thinking, que deben volver intactos).
    history.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((block) => block.type === "tool_use");
    history.push({ role: "user", content: await Promise.all(toolUses.map(runTool)) });
  }

  throw new Error("agent exceeded max iterations");
}

module.exports = { runAgent };
