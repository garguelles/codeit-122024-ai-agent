import initializeAgent, { runChatMode } from "./agent.ts";
import { Hono } from "hono";

console.log("Starting Agent...");
if (false) {
	initializeAgent()
		.then(({ agent, config }) => runChatMode(agent, config))
		.catch((error) => {
			console.error("Fatal error:", error);
			process.exit(1);
		});
}

const app = new Hono();
app.get("/", (c) => c.json({ message: "hello world" }));

Deno.serve(app.fetch);
