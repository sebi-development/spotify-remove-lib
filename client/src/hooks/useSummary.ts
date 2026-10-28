import { useEffect, useState } from "react";
import type { CategoryId } from "../../../shared/protocol";

type SummaryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; counts: Record<CategoryId, number> };

export function useSummary() {
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: 'loading' })

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch('/api/library/summary')
        if (!res.ok) return setSummaryState({ status: 'error' })
        const summary = (await res.json()) as { counts: Record<CategoryId, number> }
        return setSummaryState({status: 'ready', counts: summary.counts})
      } catch (error) {
        setSummaryState({ status: 'error' })
      }
    }
    loadSummary()
  }, [])
  return summaryState
}