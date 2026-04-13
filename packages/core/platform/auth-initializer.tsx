"use client";

import { useEffect, type ReactNode } from "react";
import { getApi } from "../api";
import { useAuthStore } from "../auth";
import { useWorkspaceStore } from "../workspace";
import { createLogger } from "../logger";
import { defaultStorage } from "./storage";
import type { StorageAdapter } from "../types/storage";

const logger = createLogger("auth");

export function AuthInitializer({
  children,
  onLogin,
  onLogout,
  storage = defaultStorage,
  autoLogin,
}: {
  children: ReactNode;
  onLogin?: () => void;
  onLogout?: () => void;
  storage?: StorageAdapter;
  /** When true, auto-login as dev user if no token exists (local dev only). */
  autoLogin?: boolean;
}) {
  useEffect(() => {
    const token = storage.getItem("multica_token");

    if (!token && autoLogin) {
      // Dev auto-login: call the dev-login endpoint, store the token, and hydrate
      const api = getApi();
      api
        .devLogin("michaelparker@ciwebgroup.com", "Michael Parker")
        .then(({ token: newToken, user }) => {
          storage.setItem("multica_token", newToken);
          api.setToken(newToken);

          return api.listWorkspaces().then((wsList) => {
            const wsId = storage.getItem("multica_workspace_id");
            onLogin?.();
            useAuthStore.setState({ user, isLoading: false });
            useWorkspaceStore.getState().hydrateWorkspace(wsList, wsId);
          });
        })
        .catch((err) => {
          logger.error("dev auto-login failed", err);
          onLogout?.();
          useAuthStore.setState({ user: null, isLoading: false });
        });
      return;
    }

    if (!token) {
      onLogout?.();
      useAuthStore.setState({ isLoading: false });
      return;
    }

    const api = getApi();
    api.setToken(token);
    const wsId = storage.getItem("multica_workspace_id");

    Promise.all([api.getMe(), api.listWorkspaces()])
      .then(([user, wsList]) => {
        onLogin?.();
        useAuthStore.setState({ user, isLoading: false });
        useWorkspaceStore.getState().hydrateWorkspace(wsList, wsId);
      })
      .catch((err) => {
        logger.error("auth init failed", err);
        api.setToken(null);
        api.setWorkspaceId(null);
        storage.removeItem("multica_token");
        storage.removeItem("multica_workspace_id");
        onLogout?.();
        useAuthStore.setState({ user: null, isLoading: false });
      });
  }, []);

  return <>{children}</>;
}
