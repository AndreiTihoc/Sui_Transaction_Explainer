"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface Transfer {
  from: string;
  to: string;
  amount: string;
  coinType: string;
}

interface TransactionVizProps {
  sender: string;
  recipients: string[];
  transfers: Transfer[];
}

function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function TransactionViz({ sender, recipients, transfers }: TransactionVizProps) {
  if (recipients.length === 0 && transfers.length === 0) {
    return null;
  }

  const displayRecipients = recipients.length > 0 ? recipients : transfers.map(t => t.to);
  const uniqueRecipients = Array.from(new Set(displayRecipients));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Flow</CardTitle>
        <CardDescription>Visual representation of value movement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-lg border-2 border-blue-500">
              <div className="text-xs text-muted-foreground mb-1">Sender</div>
              <code className="text-sm font-mono">{truncateAddress(sender, 8)}</code>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {uniqueRecipients.map((recipient, idx) => {
              const relevantTransfers = transfers.filter(t => t.to === recipient);
              const hasTransferInfo = relevantTransfers.length > 0;

              return (
                <div key={idx} className="w-full flex items-center gap-4">
                  <div className="flex-1 flex items-center justify-end gap-2">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    {hasTransferInfo && (
                      <div className="text-right">
                        {relevantTransfers.map((t, tIdx) => (
                          <div key={tIdx} className="text-xs text-muted-foreground">
                            {t.amount}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-green-100 dark:bg-green-900 px-4 py-2 rounded-lg border-2 border-green-500 min-w-[200px]">
                    <div className="text-xs text-muted-foreground mb-1">Recipient {idx + 1}</div>
                    <code className="text-sm font-mono">{truncateAddress(recipient, 8)}</code>
                  </div>
                </div>
              );
            })}
          </div>

          {transfers.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground text-center">
                Total transfers: {transfers.length}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
