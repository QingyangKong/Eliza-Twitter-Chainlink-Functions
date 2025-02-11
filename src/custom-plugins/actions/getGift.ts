import { formatEther, parseEther, getContract } from "viem";
import {
    Action,
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";

import { initWalletProvider, WalletProvider } from "../providers/wallet.ts";
import type { GetGiftParams, Transaction } from "../types/index.ts";
import { getGiftTemplate } from "../templates/index.ts";
import getGiftJson from "../artifacts/GetGift.json" with { type: "json" };

// Exported for tests
export class GetGiftAction {
    constructor(private walletProvider: WalletProvider) {}

    async getGift(params: GetGiftParams): Promise<Transaction> {
        const chainName = "avalancheFuji";
        const contractAddress = "0x5a0e7cf20d8bfb4493d73d17f2c4ae5bbbefa4b2"
        const donHostedSecretsSlotID = 0n
        const donHostedSecretsVersion = 1739285900n
        const clSubId = 15371n

        console.log(
            `Get gift with Id: ${params.code} and address (${params.address})`
        );

        this.walletProvider.switchChain(chainName);

        const walletClient = this.walletProvider.getWalletClient(
            chainName
        );

        try {
            const { abi } = getGiftJson["contracts"]["GetGift.sol:GetGift"]
            const getGiftContract = getContract({
                address: contractAddress,
                abi,
                client: walletClient
            })

            const args: string[] = [params.code];
            const userAddr = params.address;

            const hash = await getGiftContract.write.sendRequest([
                donHostedSecretsSlotID,
                donHostedSecretsVersion,
                args,
                clSubId,
                userAddr
            ])

            return {
                hash,
                from: walletClient.account!.address,
                to: contractAddress,
                value: parseEther("0"),
                data: "0x",
            };
        } catch (error) {
            if(error instanceof Error) {
                throw new Error(`Function call failed: ${error.message}`);
            } else {
                throw new Error(`Function call failed: unknown error`);
            }
        }
    }
}

const buildFunctionCallDetails = async (
    state: State,
    runtime: IAgentRuntime,
    wp: WalletProvider
): Promise<GetGiftParams> => {
    const chains = Object.keys(wp.chains);
    state.supportedChains = chains.map((item) => `"${item}"`).join("|");

    const context = composeContext({
        state,
        template: getGiftTemplate,
    });

    const functionCallDetails = (await generateObjectDeprecated({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
    })) as GetGiftParams;

    return functionCallDetails;
};

export const getGiftAction: Action = {
    name: "get gift",
    description: "Call a function on Functions consumer and send request",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        console.log("Get gift action handler called");
        const walletProvider = await initWalletProvider(runtime);
        const action = new GetGiftAction(walletProvider);

        // Compose functionCall context
        const paramOptions = await buildFunctionCallDetails(
            state,
            runtime,
            walletProvider
        );

        try {
            const callFunctionResp = await action.getGift(paramOptions);
            if (callback) {
                callback({
                    text: `Successfully called function with params of gift code: ${paramOptions.code} and address: ${paramOptions.address}\nTransaction Hash: ${callFunctionResp.hash}`,
                    content: {
                        success: true,
                        hash: callFunctionResp.hash,
                        amount: formatEther(callFunctionResp.value),
                        recipient: callFunctionResp.to,
                        chain: "avalanchefuji",
                    },
                });
            }
            return true;
        } catch (error) {
            console.error("Error during get gift call:", error);
            if(error instanceof Error) {
                if (callback) {
                    callback({
                        text: `Error get gift calling: ${error.message}`,
                        content: { error: error.message },
                    });
                }
            } else {
                console.error("unknow error")
            }
            return false;
        }
    },
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    examples: [
        [
            {
                user: "assistant",
                content: {
                    text: "I'll help you call function on contract",
                    action: "GET_GIFT",
                },
            },
            {
                user: "user",
                content: {
                    text: "Give me the gift to address 0x1234567890123456789012345678901234567890, ID for gift is 1010",
                    action: "GET_GIFT",
                },
            },
            {
                user: "user",
                content: {
                    text: "Can I get the gift to address 0x1234567890123456789012345678901234567890, my gift ID is 898770",
                    action: "GET_GIFT",
                },
            },
        ],
    ],
    similes: ["GET_GIFT", "GIFT_GIVE", "SEND_GIFT"],
};
