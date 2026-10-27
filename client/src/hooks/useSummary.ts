import { useEffect, useState } from "react";
import type { CategoryId } from "../../../shared/protocol";

type SummaryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; counts: Record<CategoryId, number> };

export async function useSummary() {
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: 'loading' })

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch('/api/library/summary')
        if (!res.ok) setSummaryState({ status: 'error' })
        const summary = (await res.json()) as { status: 'ready'; counts: Record<CategoryId, number> }
      } catch (error) {
        setSummaryState({ status: 'error' })
      }
    }
    loadSummary()
  }, [])
  return summaryState
}