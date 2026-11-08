import { base } from '$app/paths';

/** Keep links working on both the custom domain and the GitHub project URL. */
export function sitePath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') ? `${base}${path}` : path;
}
