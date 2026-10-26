import { createContext, useContext } from "react";
import type { Me } from "../share/api";

export type Account = {
  /** Null until the first answer from `/api/me`. */
  me: Me | null;
  refresh: () => Promise<Me | null>;
};

export const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount was called outside an AccountProvider.");
  return value;
}

/** Somebody the server can file a map under: an account or an anonymous device. */
export const hasIdentity = (me: Me | null): boolean => !!(me?.user || me?.device);
