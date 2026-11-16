export type TelegramOrderAction = "accept" | "cancel";

type TelegramOrderQuery = {
  telegramAction: TelegramOrderAction;
  telegramOrder?: string;
};

export function telegramOrderQuery(
  query: Record<string, unknown>,
): TelegramOrderQuery | undefined {
  const { telegramAction, telegramOrder } = query;
  if (telegramAction !== "accept" && telegramAction !== "cancel") return;
  if (telegramOrder === undefined) return { telegramAction };
  if (
    typeof telegramOrder === "string" &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(telegramOrder)
  )
    return { telegramAction, telegramOrder };
}
