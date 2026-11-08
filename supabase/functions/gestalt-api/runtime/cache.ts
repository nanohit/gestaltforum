// Every instance reads current content; edits are visible across all Edge instances.
const cache = { get: (_key: string) => undefined, set: (..._args: any[]) => {}, clear: () => {} };
export const articleCache = cache;
export const publicHtmlCache = cache;
