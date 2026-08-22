import { useRef } from "react";

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends noop>(fn: T) {
    const fnRef = useRef < T > (fn);
    fnRef.current = fn;

    const persistFn = useRef < T > (null);
    if (!persistFn.current) {
        persistFn.current = function (this, ...args) {
            return fnRef.current!.apply(this, args);
        } as T;
    }

    return persistFn.current!;
}
