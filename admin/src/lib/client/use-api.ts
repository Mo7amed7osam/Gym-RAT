"use client";

import { useCallback, useEffect, useState } from "react";

import { api, describeError } from "./api";

interface Snapshot<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/** Tiny fetch-on-mount hook with refetch; enough for a one-admin dashboard, no cache library needed. */
export function useApi<T>(path: string | null) {
  const [tick, setTick] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key: null, data: null, error: null });
  const key = path === null ? null : `${path}#${tick}`;

  useEffect(() => {
    if (path === null || key === null) return;
    let active = true;
    api<T>(path)
      .then((data) => {
        if (active) setSnapshot({ key, data, error: null });
      })
      .catch((cause: unknown) => {
        if (active) setSnapshot((current) => ({ key, data: current.data, error: describeError(cause) }));
      });
    return () => {
      active = false;
    };
  }, [key, path]);

  const refetch = useCallback(async () => {
    setTick((value) => value + 1);
  }, []);

  const setData = useCallback((data: T | null) => setSnapshot((current) => ({ ...current, data })), []);

  const loading = key !== null && snapshot.key !== key;
  return { data: snapshot.data, error: snapshot.key === key ? snapshot.error : null, loading, refetch, setData };
}
