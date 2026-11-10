"use client";

import { useCustomer } from "./customer-session";
import type { CartItem } from "./checkout-api";

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    ["variantId", "productId", "name", "storeName", "size", "color"].every(
      (key) => typeof item[key] === "string",
    ) &&
    (item.imageUrl === null ||
      (typeof item.imageUrl === "string" &&
        item.imageUrl.startsWith("https://"))) &&
    ["quantity", "availableStock", "unitPriceInCents"].every(
      (key) =>
        typeof item[key] === "number" &&
        Number.isSafeInteger(item[key]) &&
        Number(item[key]) >= 0,
    ) &&
    Number(item.quantity) > 0 &&
    Number(item.quantity) <= 1000000
  );
}
export function parseCart(raw: string): CartItem[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data)
      ? data
          .filter(isCartItem)
          .filter(
            (item, index, list) =>
              list.findIndex((other) => other.variantId === item.variantId) ===
              index,
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function useCart() {
  const account = useCustomer();
  const items = account.cart;
  const raw = JSON.stringify(items);
  return {
    items,
    raw,
    loading: account.loading || account.busy,
    add: account.add,
    change: account.change,
    remove: account.remove,
    clear: account.reload,
  };
}
