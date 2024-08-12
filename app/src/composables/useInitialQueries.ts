import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import { ref, toValue } from 'vue'

import type { APIQuery } from '@/api/api'
import api from '@/api/api'

export function useInitialQueries<
  T extends readonly any[] = any[],
  // R extends readonly any[] = any[],
>(
  queries: MaybeRefOrGetter<APIQuery[]> | ComputedRef<APIQuery[]>,
  options: {
    onQueriesResponse: (...responses: any) => Promise<T> | T
    showModal?: boolean
  },
): Promise<T> | T
export function useInitialQueries<T extends any[] = any[]>(
  queries: MaybeRefOrGetter<APIQuery[]> | ComputedRef<APIQuery[]>,
  options: { showModal?: boolean },
): Promise<T> | T
export function useInitialQueries<
  T extends any[] = any[],
  R extends any[] = any[],
>(
  queries: MaybeRefOrGetter<APIQuery[]> | ComputedRef<APIQuery[]>,
  {
    onQueriesResponse,
    showModal = false,
  }: {
    onQueriesResponse?: (...responses: T) => Promise<R> | R
    showModal?: boolean
  } = {},
): Promise<T | R> | T | R {
  return api
    .fetchAll<T>(toValue(queries), { showModal, initial: true })
    .then(async (responses) => {
      if (onQueriesResponse) {
        return await onQueriesResponse(...responses)
      }
      return responses
    })
}
