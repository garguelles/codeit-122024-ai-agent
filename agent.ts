import { CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpToolkit } from "@coinbase/cdp-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import * as fs from "node:fs";
import { HumanMessage } from "@langchain/core/messages";
import * as readline from "node:readline";

// Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initialize the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
export default async function initializeAgent() {
	// Initialize LLM
	const llm = new ChatAnthropic({
		model: "claude-3-5-sonnet-latest",
	});

	let walletDataStr: string | null = null;

	// Read existing wallet data if available
	if (fs.existsSync(WALLET_DATA_FILE)) {
		try {
			walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
		} catch (error) {
			console.error("Error reading wallet data:", error);
			// Continue without wallet data
		}
	}

	// Configure CDP Agentkit
	const config = {
		cdpWalletData: walletDataStr || undefined,
		networkId: process.env.NETWORK_ID || "base-sepolia",
	};

	// Initialize CDP agentkit
	const agentkit = await CdpAgentkit.configureWithWallet(config);

	// Initialize CDP Agentkit Toolkit and get tools
	const cdpToolkit = new CdpToolkit(agentkit);
	const tools = cdpToolkit.getTools();

	// Store buffered conversation history in memory
	const memory = new MemorySaver();
	const agentConfig = {
		configurable: { thread_id: "onchain-agent" },
	};

	// Create React Agent using the LLM and CDP Agentkit tools
	const agent = createReactAgent({
		llm,
		tools,
		checkpointSaver: memory,
		messageModifier:
			"You are a helpful agent that can interact onchain using the Coinbase Developer Platform Agentkit...",
	});

	// Save wallet data
	const exportedWallet = await agentkit.exportWallet();
	fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);

	return { agent, config: agentConfig };
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runChatMode(agent: any, config: any) {
	console.log("Starting chat mode... Type 'exit' to end.");

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve));

	try {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const userInput = await question("\nPrompt: ");

			if (userInput.toLowerCase() === "exit") {
				break;
			}

			const stream = await agent.stream(
				{ messages: [new HumanMessage(userInput)] },
				config,
			);

			for await (const chunk of stream) {
				if ("agent" in chunk) {
					console.log(chunk.agent.messages[0].content);
				} else if ("tools" in chunk) {
					console.log(chunk.tools.messages[0].content);
				}
				console.log("-------------------");
			}
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error("Error:", error.message);
		}
		process.exit(1);
	} finally {
		rl.close();
	}
}
