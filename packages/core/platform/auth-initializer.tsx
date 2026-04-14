"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApi } from "../api";
import { useAuthStore } from "../auth";
import { useWorkspaceStore } from "../workspace";
import { workspaceKeys } from "../workspace/queries";
import { createLogger } from "../logger";
import { defaultStorage } from "./storage";
import type { StorageAdapter } from "../types/storage";

const logger = createLogger("auth");

/**
 * Check whether an error represents a 401 Unauthorized response.
 * Only 401s should clear the stored token — transient network errors
 * or 5xx responses should not nuke the session.
 */
function isUnauthorizedError(err: unknown): boolean {
  if (err && typeof err === "object") {
    // Axios-style
    if ("response" in err) {
      const resp = (err as { response?: { status?: number } }).response;
      if (resp?.status === 401) return true;
    }
    // Fetch-style or custom API client
    if ("status" in err && (err as { status?: number }).status === 401) {
      return true;
    }
  }
  return false;
}

export function AuthInitializer({
  children,
  onLogin,
  onLogout,
  storage = defaultStorage,
  autoLogin,
  cookieAuth,
}: {
  children: ReactNode;
  onLogin?: () => void;
  onLogout?: () => void;
  storage?: StorageAdapter;
  /** When true, auto-login as dev user if no token exists (local dev only). */
  autoLogin?: boolean;
  cookieAuth?: boolean;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    const api = getApi();
    const wsId = storage.getItem("multica_workspace_id");

    if (cookieAuth) {
      // Cookie mode: the HttpOnly cookie is sent automatically by the browser.
      // Call the API to check if the session is still valid.
      Promise.all([api.getMe(), api.listWorkspaces()])
        .then(([user, wsList]) => {
          onLogin?.();
          useAuthStore.setState({ user, isLoading: false });
          qc.setQueryData(workspaceKeys.list(), wsList);
          useWorkspaceStore.getState().hydrateWorkspace(wsList, wsId);
        })
        .catch((err) => {
          logger.error("cookie auth init failed", err);
          onLogout?.();
          useAuthStore.setState({ user: null, isLoading: false });
        });
      return;
    }

    // Token mode: read from localStorage (Electron / legacy).
    const token = storage.getItem("multica_token");

    if (!token && autoLogin) {
      // Dev auto-login: call the dev-login endpoint, store the token, and hydrate
      api
        .devLogin("michaelparker@ciwebgroup.com", "Michael Parker")
        .then(({ token: newToken, user }) => {
          storage.setItem("multica_token", newToken);
          api.setToken(newToken);

          return api.listWorkspaces().then((wsList) => {
            onLogin?.();
            useAuthStore.setState({ user, isLoading: false });
            qc.setQueryData(workspaceKeys.list(), wsList);
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

    api.setToken(token);

    Promise.all([api.getMe(), api.listWorkspaces()])
      .then(([user, wsList]) => {
        onLogin?.();
        useAuthStore.setState({ user, isLoading: false });
        // Seed React Query cache so components don't need a second fetch
        qc.setQueryData(workspaceKeys.list(), wsList);
        useWorkspaceStore.getState().hydrateWorkspace(wsList, wsId);
      })
      .catch((err) => {
        logger.error("auth init failed", err);

        if (isUnauthorizedError(err)) {
          // 401 means the token is genuinely invalid — clear it.
          api.setToken(null);
          api.setWorkspaceId(null);
          storage.removeItem("multica_token");
          storage.removeItem("multica_workspace_id");
          onLogout?.();
          useAuthStore.setState({ user: null, isLoading: false });
        } else {
          // Transient error (network, 5xx, etc.) — don't nuke the session.
          // Retry after a short delay so the user isn't logged out when the
          // backend briefly goes down.
          logger.error("transient error during auth init, retrying in 2s…");
          setTimeout(() => {
            useAuthStore.setState({ isLoading: true });
            Promise.all([api.getMe(), api.listWorkspaces()])
              .then(([user, wsList]) => {
                onLogin?.();
                useAuthStore.setState({ user, isLoading: false });
                qc.setQueryData(workspaceKeys.list(), wsList);
                useWorkspaceStore.getState().hydrateWorkspace(wsList, wsId);
              })
              .catch((retryErr) => {
                logger.error("auth retry failed", retryErr);
                if (isUnauthorizedError(retryErr)) {
                  api.setToken(null);
                  api.setWorkspaceId(null);
                  storage.removeItem("multica_token");
                  storage.removeItem("multica_workspace_id");
                }
                onLogout?.();
                useAuthStore.setState({ user: null, isLoading: false });
              });
          }, 2000);
        }
      });
  }, []);

  return <>{children}</>;
}
