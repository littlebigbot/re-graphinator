/**
 * Returns a debounced version of `fn` that delays invoking it by `ms`
 * milliseconds after the last call.
 */
export function useDebounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: TArgs) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
