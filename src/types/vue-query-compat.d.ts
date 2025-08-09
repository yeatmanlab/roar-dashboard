import type {
  UseQueryOptions as V5UseQueryOptions,
  UseQueryReturnType as V5UseQueryReturnType,
  QueryKey,
} from '@tanstack/vue-query'

export {}

declare global {
  // Legacy aliases mapped to v5
  type UseQueryOptions<TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = V5UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
  type UseQueryReturnType<TData = unknown, TError = Error> = V5UseQueryReturnType<TData, TError>

  // Common legacy names referenced in tests; map loosely to v5 to satisfy typecheck
  type CacheQueryOptions<TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = V5UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
  type UseQueryDefinedReturnType<TData = unknown, TError = Error> = V5UseQueryReturnType<TData, TError>
  type QueryOptionsWithEnabled<TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = V5UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
}
