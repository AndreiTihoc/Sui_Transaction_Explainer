import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

export type SuiNetwork = "mainnet" | "testnet";

export function getSuiClient(network: SuiNetwork = "mainnet"): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(network) });
}

export function formatSuiAmount(amount: bigint | string | number): string {
  const decimals = 9;
  const amountBigInt = typeof amount === "bigint" ? amount : BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  if (trimmedFractional === "") {
    return wholePart.toString();
  }

  return `${wholePart}.${trimmedFractional}`;
}

export function extractDigestFromUrl(input: string): string {
  input = input.trim();

  const urlPattern = /(?:https?:\/\/)?(?:suiscan\.xyz|suivision\.xyz|explorer\.sui\.io)\/[^\/]*\/tx\/([A-Za-z0-9]+)/i;
  const match = input.match(urlPattern);

  if (match && match[1]) {
    return match[1];
  }

  return input;
}
