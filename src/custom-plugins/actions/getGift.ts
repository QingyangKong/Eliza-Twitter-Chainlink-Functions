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
        const contractAddress = "0xFe3792fE8EA6B70cB6907f9EDC8C99AfF35fE8eA"
        const encryptedSecretsUrls = "0x388c087eea8655e4d6a7e24617f6b6d602932d79c4792e2245d1f255b194117dc9bb74b3c7f5a396e7a6fc69f03ce65b41737cd5a264cc93ad132927b1ecf9a5d523c93f62218265e14d8e0b5abc91879897d8917a9c14df5a214610f1b4fa8976e198df3784af18181a466af95f752285eb264a9e0a87e0c72c7f46f03791d2e59a6cf557d094e5f4b2879a00cb38aa054eade9c14c9506ed2559da491437be30"
        const clSubId = 14697n

        console.log(
            `Get gift with Id: ${params.code} and address (${params.address})`
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

            const args: string[] = [params.code];
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
