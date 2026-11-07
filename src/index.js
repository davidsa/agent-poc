const fs = require("node:fs");
const path = require("node:path");

// Debe ir antes de importar ./agent: el cliente de Anthropic lee ANTHROPIC_API_KEY al crearse.
// Sin .env (p. ej. en producción) se usan las variables del entorno; las ya definidas no se sobreescriben.
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

const fastify = require("fastify")({ logger: true });
const { runAgent } = require("./agent");

const chatSchema = {
  body: {
    type: "object",
    required: ["messages"],
    properties: {
      messages: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: { enum: ["user", "assistant"] },
            content: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

fastify.get("/api/health", async () => ({ ok: true }));

fastify.post("/api/chat", { schema: chatSchema }, async (request, reply) => {
  try {
    return await runAgent(request.body);
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: "Error ejecutando el agente" });
  }
});

// En producción sirve el frontend compilado (`npm run build`). En desarrollo no existe
// y el frontend corre con Vite, que hace proxy de /api a este servidor.
const webDist = path.join(__dirname, "..", "web", "dist");
if (fs.existsSync(webDist)) {
  fastify.register(require("@fastify/static"), { root: webDist });
  // Rutas del frontend (SPA) que no son archivos devuelven index.html; /api desconocido sigue siendo 404.
  fastify.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not found" });
  });
}

fastify.listen({ port: Number(process.env.PORT) || 3000 }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
