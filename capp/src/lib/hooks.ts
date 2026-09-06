/**
 * lib/hooks.ts — tiny polling hooks (no data-fetching dependency needed).
 * Keeps previous data while refreshing so the UI never flickers.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface PollState<T> {
  data: T | null
  error: string | null
  /** true only until the first successful (or failed) load */
  loading: boolean
  /** true during any background refresh */
  refreshing: boolean
  refresh: () => void
}

export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number | null,
  deps: readonly unknown[],
): PollState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const runId = useRef(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback((isRefresh: boolean) => {
    const id = ++runId.current
    if (isRefresh) setRefreshing(true)
    fetcherRef
      .current()
      .then((result) => {
        if (runId.current !== id) return
        setData(result)
        setError(null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (runId.current !== id) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
      .finally(() => {
        if (runId.current === id) setRefreshing(false)
      })
  }, [])

  const refresh = useCallback(() => run(true), [run])

  useEffect(() => {
    setLoading(true)
    setError(null)
    run(false)
    if (intervalMs == null || intervalMs <= 0) return
    const timer = setInterval(() => run(true), intervalMs)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, run])

  return { data, error, loading, refreshing, refresh }
}
