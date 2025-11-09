import { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { formatSuiAmount } from "./sui";

export interface TransactionFacts {
  digest: string;
  sender: string;
  checkpoint?: string;
  timestampMs?: string;
  status: string;
  gasUsedSui: string;
  balanceChanges: Array<{
    owner: string;
    coinType: string;
    amount: string;
  }>;
  moveCall?: {
    package: string;
    module: string;
    function: string;
  };
  recipients: string[];
  objectChanges: {
    created: string[];
    mutated: string[];
    deleted: string[];
  };
  events: Array<{
    type: string;
    sender?: string;
  }>;
}

export function parseTransactionData(
  tx: SuiTransactionBlockResponse
): TransactionFacts {
  const sender = tx.transaction?.data.sender || "unknown";
  const status = tx.effects?.status.status || "unknown";

  const gasUsed = tx.effects?.gasUsed;
  let gasUsedSui = "0";

  if (gasUsed) {
    const computationCost = BigInt(gasUsed.computationCost || 0);
    const storageCost = BigInt(gasUsed.storageCost || 0);
    const storageRebate = BigInt(gasUsed.storageRebate || 0);
    const totalGas = computationCost + storageCost - storageRebate;
    gasUsedSui = formatSuiAmount(totalGas);
  }

  const balanceChanges = (tx.balanceChanges || []).map((change) => {
    let owner = "unknown";
    if (typeof change.owner === "object" && change.owner !== null) {
      if ("AddressOwner" in change.owner) {
        owner = change.owner.AddressOwner;
      } else if ("ObjectOwner" in change.owner) {
        owner = change.owner.ObjectOwner;
      }
    }
    return {
      owner,
      coinType: change.coinType,
      amount: change.amount,
    };
  });

  const recipients = Array.from(
    new Set(
      balanceChanges
        .filter((bc) => bc.owner !== sender && bc.owner !== "unknown")
        .map((bc) => bc.owner)
    )
  );

  const transactions = tx.transaction?.data.transaction as any;
  let moveCall: TransactionFacts["moveCall"] = undefined;

  if (transactions && typeof transactions === "object" && "kind" in transactions && transactions.kind === "ProgrammableTransaction") {
    const commands = (transactions as any).transactions || [];

    for (const cmd of commands) {
      if (typeof cmd === "object" && cmd !== null && "MoveCall" in cmd) {
        const mc = (cmd as any).MoveCall;
        moveCall = {
          package: mc.package,
          module: mc.module,
          function: mc.function,
        };
        break;
      }
    }
  }

  const objectChanges = tx.objectChanges || [];
  const created: string[] = [];
  const mutated: string[] = [];
  const deleted: string[] = [];

  for (const change of objectChanges) {
    if (change.type === "created" && "objectId" in change) {
      created.push(change.objectId);
    } else if (change.type === "mutated" && "objectId" in change) {
      mutated.push(change.objectId);
    } else if (change.type === "deleted" && "objectId" in change) {
      deleted.push(change.objectId);
    }
  }

  const events = (tx.events || []).map((event) => ({
    type: event.type,
    sender: event.sender,
  }));

  return {
    digest: tx.digest,
    sender,
    checkpoint: tx.checkpoint || undefined,
    timestampMs: tx.timestampMs || undefined,
    status,
    gasUsedSui,
    balanceChanges,
    moveCall,
    recipients,
    objectChanges: {
      created,
      mutated,
      deleted,
    },
    events,
  };
}
