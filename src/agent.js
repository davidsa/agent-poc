const { listProperties, getProperty } = require("./properties");

const SYSTEM_PROMPT = `Eres un asesor inmobiliario. Ayudas al usuario a elegir la propiedad que más le conviene del catálogo.

Cómo trabajar:
- Si el usuario no ha dado presupuesto, zona, número de alcobas y necesidades (mascotas, familia, carro, inversión), pregunta lo esencial antes de recomendar.
- Consulta el catálogo con list_properties y abre el detalle con get_property solo de las candidatas.
- Recomienda de 1 a 3 propiedades, explica por qué encajan y menciona sus desventajas. Incluye la administración mensual al comparar precios.
- Usa únicamente datos del catálogo. Si algo no aparece, dilo; no inventes propiedades ni características.
- Responde en el idioma del usuario, de forma breve y clara.`;

// El Agent SDK es ESM-only; se importa dinámicamente desde CommonJS.
const sdkPromise = import("@anthropic-ai/claude-agent-sdk");
const zodPromise = import("zod");

const MCP_SERVER_NAME = "properties";
const ALLOWED_TOOLS = [
  `mcp__${MCP_SERVER_NAME}__list_properties`,
  `mcp__${MCP_SERVER_NAME}__get_property`,
];

const text = (value) => ({ content: [{ type: "text", text: value }] });

async function buildPropertiesServer() {
  const { tool, createSdkMcpServer } = await sdkPromise;
  const { z } = await zodPromise;

  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    tools: [
      tool(
        "list_properties",
        "Lista todas las propiedades del catálogo con id, título, tipo, precio en COP, zona, estrato, alcobas, baños, m2 y parqueaderos.",
        {},
        async () => text(JSON.stringify(await listProperties(), null, 2)),
      ),
      tool(
        "get_property",
        "Devuelve la ficha completa (características, administración, entorno) de una propiedad por su id.",
        { id: z.string().describe("Id de la propiedad, tal como aparece en list_properties") },
        async ({ id }) => {
          const property = await getProperty(id);
          return property
            ? text(property)
            : { ...text(`No existe una propiedad con id "${id}".`), isError: true };
        },
      ),
    ],
  });
}

const serverPromise = buildPropertiesServer();

async function runAgent({ message, sessionId }) {
  const { query } = await sdkPromise;

  let result;
  for await (const msg of query({
    prompt: message,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      tools: [], // sin herramientas integradas
      mcpServers: { [MCP_SERVER_NAME]: await serverPromise },
      allowedTools: ALLOWED_TOOLS, // auto-aprobadas, sin pedir confirmación
      maxTurns: 5,
      ...(sessionId && { resume: sessionId }),
    },
  })) {
    if (msg.type === "result") result = msg;
  }

  if (!result || result.subtype !== "success") {
    throw new Error(`agent run failed: ${result?.subtype ?? "no result"}`);
  }
  return { reply: result.result, sessionId: result.session_id };
}

module.exports = { runAgent };
