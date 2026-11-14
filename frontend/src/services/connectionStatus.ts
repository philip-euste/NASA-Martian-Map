// frontend/src/services/connectionStatus.ts
// Centralized connection & data-service status store for Phase 1 Foundation & Reliability.
// Distinguishes between browser internet connectivity (navigator.onLine),
// FastAPI backend/DEM service status, and NASA Mars Trek WMTS imagery service status.

import { useEffect, useState } from "react";

export type BackendServiceStatus = "unknown" | "online" | "fallback" | "offline";
export type NasaServiceStatus = "unknown" | "online" | "degraded" | "offline";

export interface ConnectionStatusState {
  readonly networkOnline: boolean;
  readonly backendStatus: BackendServiceStatus;
  readonly backendMessage: string | null;
  readonly nasaWmtsStatus: NasaServiceStatus;
  readonly nasaWmtsMessage: string | null;
  readonly lastUpdated: number;
}

type Listener = (state: ConnectionStatusState) => void;

const listeners = new Set<Listener>();

let state: ConnectionStatusState = {
  networkOnline:
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true,
  backendStatus: "unknown",
  backendMessage: null,
  nasaWmtsStatus: "unknown",
  nasaWmtsMessage: null,
  lastUpdated: Date.now(),
};

function emitChange(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function updateState(patch: Partial<ConnectionStatusState>): void {
  const next: ConnectionStatusState = {
    ...state,
    ...patch,
    lastUpdated: Date.now(),
  };

  if (
    next.networkOnline === state.networkOnline &&
    next.backendStatus === state.backendStatus &&
    next.backendMessage === state.backendMessage &&
    next.nasaWmtsStatus === state.nasaWmtsStatus &&
    next.nasaWmtsMessage === state.nasaWmtsMessage
  ) {
    return;
  }

  state = next;
  emitChange();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    updateState({ networkOnline: true });
  });

  window.addEventListener("offline", () => {
    updateState({ networkOnline: false });
  });
}

export function getConnectionStatus(): ConnectionStatusState {
  return state;
}

export function setNetworkOnlineStatus(online: boolean): void {
  updateState({ networkOnline: online });
}

export function reportBackendStatus(
  backendStatus: BackendServiceStatus,
  backendMessage: string | null = null
): void {
  updateState({
    backendStatus,
    backendMessage,
  });
}

export function reportNasaWmtsStatus(
  nasaWmtsStatus: NasaServiceStatus,
  nasaWmtsMessage: string | null = null
): void {
  updateState({
    nasaWmtsStatus,
    nasaWmtsMessage,
  });
}

export function subscribeConnectionStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConnectionStatus(): ConnectionStatusState {
  const [current, setCurrent] = useState<ConnectionStatusState>(() =>
    getConnectionStatus()
  );

  useEffect(() => {
    setCurrent(getConnectionStatus());
    return subscribeConnectionStatus((nextState) => {
      setCurrent(nextState);
    });
  }, []);

  return current;
}
