import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { api } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export type User = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  bio?: string;
  profile_picture?: string;
  cover_picture?: string;
  is_private?: boolean;
  email_verified?: boolean;
  provider?: string;
  online?: boolean;
  last_seen?: string;
  badge_type?: string | null;
};

export type StoredAccount = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  profile_picture?: string;
  token: string;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  accounts: StoredAccount[];
  login: (email: string, password: string, opts?: { addAccount?: boolean }) => Promise<void>;
  signup: (email: string, password: string, username: string, display_name: string) => Promise<{ verify_token?: string }>;
  logout: () => Promise<void>;
  switchAccount: (user_id: string) => Promise<void>;
  removeAccount: (user_id: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const ACCOUNTS_KEY = "nexus_accounts";
const ACTIVE_KEY = "nexus_active_user";

async function readAccounts(): Promise<StoredAccount[]> {
  try {
    const raw = await storage.secureGet<string>(ACCOUNTS_KEY, "");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(list: StoredAccount[]) {
  await storage.secureSet(ACCOUNTS_KEY, JSON.stringify(list));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const applyActive = useCallback((acc: StoredAccount, u: User) => {
    setToken(acc.token);
    setUser(u);
    storage.secureSet(ACTIVE_KEY, acc.user_id);
  }, []);

  const upsertAccount = useCallback(async (u: User, tok: string): Promise<StoredAccount[]> => {
    const list = await readAccounts();
    const entry: StoredAccount = {
      user_id: u.user_id,
      email: u.email,
      username: u.username,
      display_name: u.display_name,
      profile_picture: u.profile_picture,
      token: tok,
    };
    const next = [entry, ...list.filter((a) => a.user_id !== u.user_id)];
    await writeAccounts(next);
    setAccounts(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const u = await api<User>("/auth/me", { token });
      setUser(u);
      await upsertAccount(u, token);
    } catch (e: any) {
      if (e.status === 401) {
        setToken(null);
        setUser(null);
      }
    }
  }, [token, upsertAccount]);

  useEffect(() => {
    (async () => {
      const list = await readAccounts();
      setAccounts(list);
      const activeId = await storage.secureGet<string>(ACTIVE_KEY, "");
      const active = list.find((a) => a.user_id === activeId) || list[0];
      if (active) {
        try {
          const u = await api<User>("/auth/me", { token: active.token });
          applyActive(active, u);
        } catch {
          // stale token — remove it
          const cleaned = list.filter((a) => a.user_id !== active.user_id);
          await writeAccounts(cleaned);
          setAccounts(cleaned);
        }
      }
      setLoading(false);
    })();
  }, [applyActive]);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const list = await upsertAccount(r.user, r.token);
    const active = list.find((a) => a.user_id === r.user.user_id)!;
    applyActive(active, r.user);
  };

  const signup = async (email: string, password: string, username: string, display_name: string) => {
    const r = await api<{ token: string; user: User; verify_token?: string }>("/auth/signup", {
      method: "POST",
      body: { email, password, username, display_name },
    });
    const list = await upsertAccount(r.user, r.token);
    const active = list.find((a) => a.user_id === r.user.user_id)!;
    applyActive(active, r.user);
    return { verify_token: r.verify_token };
  };

  const logout = async () => {
    try {
      if (token) await api("/auth/logout", { method: "POST", token });
    } catch {}
    // remove current account from stored list
    if (user) {
      const list = (await readAccounts()).filter((a) => a.user_id !== user.user_id);
      await writeAccounts(list);
      setAccounts(list);
      // switch to next available or clear
      if (list[0]) {
        try {
          const u = await api<User>("/auth/me", { token: list[0].token });
          applyActive(list[0], u);
          return;
        } catch {
          await writeAccounts(list.slice(1));
          setAccounts(list.slice(1));
        }
      }
    }
    await storage.secureRemove(ACTIVE_KEY);
    setToken(null);
    setUser(null);
  };

  const switchAccount = async (user_id: string) => {
    const list = await readAccounts();
    const target = list.find((a) => a.user_id === user_id);
    if (!target) return;
    try {
      const u = await api<User>("/auth/me", { token: target.token });
      applyActive(target, u);
    } catch (e: any) {
      // token expired -> drop
      const cleaned = list.filter((a) => a.user_id !== user_id);
      await writeAccounts(cleaned);
      setAccounts(cleaned);
      throw new Error("Session expired, please sign in again");
    }
  };

  const removeAccount = async (user_id: string) => {
    const list = (await readAccounts()).filter((a) => a.user_id !== user_id);
    await writeAccounts(list);
    setAccounts(list);
    if (user?.user_id === user_id) {
      if (list[0]) {
        try {
          const u = await api<User>("/auth/me", { token: list[0].token });
          applyActive(list[0], u);
          return;
        } catch {}
      }
      await storage.secureRemove(ACTIVE_KEY);
      setToken(null);
      setUser(null);
    }
  };

  const deleteAccount = async (password?: string) => {
    if (!token || !user) return;
    await api("/users/me", { method: "DELETE", body: { password }, token });
    // wipe this account, keep others
    const list = (await readAccounts()).filter((a) => a.user_id !== user.user_id);
    await writeAccounts(list);
    setAccounts(list);
    if (list[0]) {
      try {
        const u = await api<User>("/auth/me", { token: list[0].token });
        applyActive(list[0], u);
        return;
      } catch {}
    }
    await storage.secureRemove(ACTIVE_KEY);
    setToken(null);
    setUser(null);
  };

  const updateUser = async (patch: Partial<User>) => {
    if (!token) return;
    const u = await api<User>("/users/me", { method: "PUT", body: patch, token });
    setUser(u);
    await upsertAccount(u, token);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, accounts, login, signup, logout, switchAccount, removeAccount, deleteAccount, refresh, updateUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
