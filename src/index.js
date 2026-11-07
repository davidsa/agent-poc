// Debe ir antes de importar ./agent: el cliente de Anthropic lee ANTHROPIC_API_KEY al crearse.
// Sin .env (p. ej. en producción) se usan las variables del entorno; las ya definidas no se sobreescriben.
try {
  process.loadEnvFile(require("node:path").join(__dirname, "..", ".env"));
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

fastify.listen({ port: Number(process.env.PORT) || 3000 }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
