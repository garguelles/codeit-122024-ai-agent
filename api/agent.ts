import { Coinbase } from "@coinbase/coinbase-sdk";
import { CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpTool, CdpToolkit } from "@coinbase/cdp-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import * as fs from "node:fs";
import createWallet, {
	CreateWalletInput,
	CREATE_WALLET_PROMPT,
} from "./wallet-tool.ts";

Coinbase.configure({
	apiKeyName: Deno.env.get("CDP_API_KEY_NAME"),
	privateKey: Deno.env.get("CDP_API_KEY_PRIVATE_KEY"),
});

const WALLET_DATA_FILE = "wallet_data.txt";

export default async function initializeAgent() {
	try {
		const llm = new ChatAnthropic({
			model: "claude-3-5-sonnet-latest",
		});

		let walletDataStr: string | null = null;

		if (fs.existsSync(WALLET_DATA_FILE)) {
			try {
				walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
			} catch (error) {
				console.error("Error reading wallet data:", error);
			}
		}

		const config = {
			cdpWalletData: walletDataStr || undefined,
			networkId: process.env.NETWORK_ID || "base-sepolia",
		};

		const agentkit = await CdpAgentkit.configureWithWallet(config);

		const cdpToolkit = new CdpToolkit(agentkit);
		const tools = cdpToolkit.getTools();

		// Add the wallet creation tool
		const userWalletTool = new CdpTool(
			{
				name: "create_user_wallet",
				description: CREATE_WALLET_PROMPT,
				argsSchema: CreateWalletInput,
				func: createWallet,
			},
			agentkit,
		);
		tools.push(userWalletTool);

		const memory = new MemorySaver();
		const agentConfig = {
			configurable: { thread_id: "onchain-agent" },
		};

		const agent = createReactAgent({
			llm,
			tools,
			checkpointSaver: memory,
			messageModifier: `You are a helpful agent that can interact onchain using the Coinbase Developer Platform Agentkit.
      You can create wallets for users using the create_user_wallet tool.
      When a user asks to create a wallet, extract their name and ID from the request and use the tool.
      For example, if they say "Create a wallet for Gerard with User ID: 1", use id: "1" and name: "Gerard".
      Always confirm wallet creation and provide the wallet address to the user.
      If a user doesn't provide an ID, ask them for one.
      If a user already has a wallet, inform them and show their existing wallet address.
      For blockchain operations, use the CDP tools.`,
		});

		const exportedWallet = await agentkit.exportWallet();
		fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);

		return { agent, config: agentConfig };
	} catch (error) {
		console.error("Failed to initialize agent:", error);
		throw error;
	}
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
