import { lazy, type ComponentType } from 'react';

/** Route page loaded on demand (own chunk) from a module that exports it by name. */
export function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}
