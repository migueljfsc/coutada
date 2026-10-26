import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Me } from "../share/api";
import { AccountContext, type Account } from "./context";

/** Who the browser is, from `/api/me`, refreshed after anything that changes it. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    const result = await api<Me>("GET", "/api/me");
    if (result.ok) setMe(result.data);
    return result.ok ? result.data : null;
  }, []);

  useEffect(() => {
    // The first answer arrives asynchronously; setting state from it is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo<Account>(() => ({ me, refresh }), [me, refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
