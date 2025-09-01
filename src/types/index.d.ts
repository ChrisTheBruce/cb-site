// Shared types used by services/hooks
export type ApiOk<T = unknown> = { ok: true } & T;
export type ApiErr = { ok: false; error: string; rid?: string; details?: any };
export type ApiResp<T = unknown> = ApiOk<T> | ApiErr;

export type User = { name: string };
