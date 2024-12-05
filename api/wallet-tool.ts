import { CdpTool } from "@coinbase/cdp-langchain";
import { Wallet, WalletData } from "@coinbase/coinbase-sdk";
import * as fs from "node:fs";
import { z } from "zod";

export const CREATE_WALLET_PROMPT = `
This tool creates a new wallet for a user and stores it securely.
The wallet will be created on the Base Sepolia testnet and the data will be stored locally.
`;

export const CreateWalletInput = z
	.object({
		id: z.string().describe("User ID for the wallet"),
		name: z.string().describe("Name of the user"),
	})
	.strip()
	.describe("Instructions for creating a user wallet");

interface UserWalletInfo {
	id: string;
	name: string;
	walletData: WalletData;
	address: string;
	createdAt: string;
}

const USER_WALLETS_FILE = "user_wallets.json";

function loadUserWallets(): Map<string, UserWalletInfo> {
	try {
		if (fs.existsSync(USER_WALLETS_FILE)) {
			const data = JSON.parse(fs.readFileSync(USER_WALLETS_FILE, "utf8"));
			return new Map(Object.entries(data));
		}
	} catch (error) {
		console.error("Error loading user wallets:", error);
	}
	return new Map();
}

function saveUserWallets(wallets: Map<string, UserWalletInfo>) {
	try {
		const data = Object.fromEntries(wallets);
		fs.writeFileSync(USER_WALLETS_FILE, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error("Error saving user wallets:", error);
		throw new Error("Failed to save user wallet data");
	}
}

/**
 * Creates a new wallet for a user and stores it
 *
 * @param args - The input arguments for the action
 * @returns Status message with wallet address
 */
export default async function createWallet(
	args: z.infer<typeof CreateWalletInput>,
): Promise<string> {
	const userWallets = loadUserWallets();
	try {
		const { id, name } = args;

		if (userWallets.has(id)) {
			const existingWallet = userWallets.get(id);
			return `${name} (ID: ${id}) already has a wallet with address: ${existingWallet?.address}`;
		}

		const newWallet = await Wallet.create({
			networkId: "base-sepolia",
		});

		console.log("WALLET!!!", newWallet);

		const walletData = newWallet.export();
		const address = await newWallet.getDefaultAddress();

		const userWallet: UserWalletInfo = {
			id,
			name,
			walletData,
			address: address.toString(),
			createdAt: new Date().toISOString(),
		};

		userWallets.set(id, userWallet);
		saveUserWallets(userWallets);

		return `Successfully created a wallet for ${name} (ID: ${id}).\nWallet address: ${address}`;
	} catch (error) {
		console.error("Error creating wallet:", error);
		throw new Error(`Failed to create wallet: ${error.message}`);
	}
}
