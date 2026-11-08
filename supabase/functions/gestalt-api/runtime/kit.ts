export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class Redirect extends Error {
  constructor(public status: number, public location: string) { super(location); }
}
export function error(status: number, message: string): never { throw new HttpError(status, message); }
export function redirect(status: number, location: string): never { throw new Redirect(status, location); }
export const fail = (status: number, data: any) => ({ __failure: true, status, data });
export const json = (data: any, init?: ResponseInit) => Response.json(data, init);
