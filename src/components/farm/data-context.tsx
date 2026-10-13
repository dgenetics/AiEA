"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/farm-api";
import type {
  Asset,
  AssetInput,
  SystemComponent,
  SystemComponentInput,
  SystemComponentPatch,
} from "@/lib/farm-types";

interface DataContextValue {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getAsset: (id: string) => Asset | undefined;
  addAsset: (input: AssetInput) => Promise<Asset>;
  updateAsset: (id: string, patch: Partial<AssetInput>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  addComponent: (
    assetId: string,
    input: SystemComponentInput,
  ) => Promise<SystemComponent>;
  updateComponent: (
    assetId: string,
    componentId: string,
    patch: SystemComponentPatch,
  ) => Promise<void>;
  deleteComponent: (assetId: string, componentId: string) => Promise<void>;
  duplicateComponent: (
    assetId: string,
    componentId: string,
  ) => Promise<SystemComponent | undefined>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await api.listSystems();
      setAssets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getAsset = useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets],
  );

  const addAsset = useCallback(async (input: AssetInput) => {
    const asset = await api.createSystem(input);
    setAssets((prev) => [asset, ...prev]);
    return asset;
  }, []);

  const updateAsset = useCallback(
    async (id: string, patch: Partial<AssetInput>) => {
      const updated = await api.updateSystem(id, patch);
      setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
    },
    [],
  );

  const deleteAsset = useCallback(async (id: string) => {
    await api.deleteSystem(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addComponent = useCallback(
    async (assetId: string, input: SystemComponentInput) => {
      const component = await api.addComponent(assetId, input);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? {
                ...a,
                components: [...a.components, component],
                updatedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      return component;
    },
    [],
  );

  const updateComponent = useCallback(
    async (
      assetId: string,
      componentId: string,
      patch: SystemComponentPatch,
    ) => {
      // Reparent: persist then reload both systems so registries stay honest.
      if (patch.systemId !== undefined && patch.systemId !== assetId) {
        try {
          await api.updateComponent(assetId, componentId, patch);
          await refresh();
        } catch (e) {
          await refresh();
          throw e;
        }
        return;
      }

      // Optimistic local merge (inputs keep their own draft while focused)
      const { systemId: _ignored, ...fieldPatch } = patch;
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? {
                ...a,
                components: a.components.map((c) =>
                  c.id === componentId ? { ...c, ...fieldPatch } : c,
                ),
                updatedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      try {
        // Persist full draft fields; do not re-apply server payload over
        // local state (avoids races that glitch typing).
        await api.updateComponent(assetId, componentId, fieldPatch);
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [refresh],
  );

  const deleteComponent = useCallback(
    async (assetId: string, componentId: string) => {
      await api.deleteComponent(assetId, componentId);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? {
                ...a,
                components: a.components.filter((c) => c.id !== componentId),
                updatedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
    },
    [],
  );

  const duplicateComponent = useCallback(
    async (assetId: string, componentId: string) => {
      const created = await api.duplicateComponent(assetId, componentId);
      // Refresh that system so sort order is correct
      const system = await api.listSystems().then((list) =>
        list.find((a) => a.id === assetId),
      );
      if (system) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? system : a)));
      }
      return created;
    },
    [],
  );

  const value = useMemo(
    () => ({
      assets,
      loading,
      error,
      refresh,
      getAsset,
      addAsset,
      updateAsset,
      deleteAsset,
      addComponent,
      updateComponent,
      deleteComponent,
      duplicateComponent,
    }),
    [
      assets,
      loading,
      error,
      refresh,
      getAsset,
      addAsset,
      updateAsset,
      deleteAsset,
      addComponent,
      updateComponent,
      deleteComponent,
      duplicateComponent,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
