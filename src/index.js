const fastify = require("fastify")({ logger: true });
const { runAgent } = require("./agent");

const chatSchema = {
  body: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", minLength: 1 },
      sessionId: { type: "string" },
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
