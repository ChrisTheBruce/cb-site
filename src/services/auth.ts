import { apiGet, apiPost } from "./api";
import type { ApiResp, User } from "@/types";

export async function me(): Promise<ApiResp<{ user: User }>> {
  return apiGet("/api/me");
}

export async function login(username: string, password: string): Promise<ApiResp<{ user: User }>> {
  return apiPost("/api/login", { username, password });
}

export async function logout(): Promise<ApiResp> {
  return apiPost("/api/logout");
}
