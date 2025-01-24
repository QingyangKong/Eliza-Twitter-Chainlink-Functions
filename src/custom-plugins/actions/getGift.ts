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
        const contractAddress = "0xbf8ee4a627d5b9bf50387906feafa00cbea84c41"
        const encryptedSecretsUrls = "0xf255d1f7cd5416f9c2bbded6f5c908720237ff36d0e974e7d8ad71a1537a74ec9fae006e4a0eadaeaa6e8fd46aa69918195265434b99c99a020d39c33a8d331ecba299c01bfb6155642362a1e1dd6ec13145b11dd96680dcc16005141aaa74369191263a2a5b9408764f3c3b981c4fb17e3ba4573696f28d1daa5d4b7413c017f097d2ba08fe96cd18ae8ca4c26a54ea4ec949b5b1009ee09be894dafd9be678d4"
        const clSubId = 14697n

        console.log(
            `Get gift with Id: ${params.id} and address (${params.address})`
        );

        this.walletProvider.switchChain(chainName);

        const walletClient = this.walletProvider.getWalletClient(
            chainName
        );

        try {
            const { abi } = getGiftJson["contracts"]["contracts/GetGift.sol:GetGift"]
            const getGiftContract = getContract({
                address: contractAddress,
                abi,
                client: walletClient
            })

            const args: string[] = [params.id];
            const userAddr = params.address;

            const hash = await getGiftContract.write.sendRequest([
                encryptedSecretsUrls,
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
                    text: `Successfully called function with params of id: ${paramOptions.id} and address: ${paramOptions.address}\nTransaction Hash: ${callFunctionResp.hash}`,
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
