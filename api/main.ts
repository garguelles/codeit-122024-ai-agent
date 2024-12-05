import { Hono } from "hono";
import initializeAgent from "./agent.ts";
import { HumanMessage } from "@langchain/core/messages";

const app = new Hono();

// Store active WebSocket connections
const sockets = new Set<WebSocket>();

// Initialize agent once for reuse
const agentPromise = initializeAgent();

app.get("/", (c) => c.json({ message: "hello world" }));

app.get("/ws", async (c) => {
	if (c.req.header("upgrade") !== "websocket") {
		return c.text("This route requires a WebSocket connection.", 400);
	}

	const { response, socket } = Deno.upgradeWebSocket(c.req.raw);

	const { agent, config } = await agentPromise;

	sockets.add(socket);

	socket.onopen = () => {
		console.log("WebSocket connected");
	};

	socket.onmessage = async (event) => {
		try {
			const message = event.data;

			const stream = await agent.stream(
				{ messages: [new HumanMessage(message)] },
				config,
			);

			for await (const chunk of stream) {
				if ("agent" in chunk) {
					socket.send(
						JSON.stringify({
							type: "agent",
							content: chunk.agent.messages[0].content,
						}),
					);
				} else if ("tools" in chunk) {
					socket.send(
						JSON.stringify({
							type: "tools",
							content: chunk.tools.messages[0].content,
						}),
					);
				}
			}
		} catch (error) {
			console.error("Error processing message:", error);
			socket.send(
				JSON.stringify({
					type: "error",
					content: "Error processing your message",
				}),
			);
		}
	};

	socket.onclose = () => {
		console.log("WebSocket disconnected");
		sockets.delete(socket);
	};

	return response;
});

Deno.serve(app.fetch);
