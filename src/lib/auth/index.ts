export { SessionError, toSessionError } from "@/lib/auth/error.ts";
export {
  activeSession,
  isSessionExpired,
  REFRESH_LEAD_MS,
  refreshDelayMs,
} from "@/lib/auth/session.ts";
export {
  browserLocalStorage,
  clearSessionCache,
  createMemorySessionStorage,
  createSessionCache,
  DEFAULT_OFFLINE_GRACE_MS,
  isWithinOfflineGrace,
  SESSION_CACHE_KEY,
  sessionFromCache,
  writeSessionCache,
} from "@/lib/auth/cache.ts";
export type {
  CachedSessionOptions,
  SessionCache,
  SessionCacheRecord,
  SessionCacheStorage,
} from "@/lib/auth/cache.ts";
export {
  createSessionChannel,
  DEFAULT_SESSION_CHANNEL,
} from "@/lib/auth/channel.ts";
export type { SessionChannel, SessionEvent } from "@/lib/auth/channel.ts";
export {
  createRefreshCoordinator,
  createRefreshLock,
  DEFAULT_REFRESH_LOCK,
} from "@/lib/auth/refresh.ts";
export {
  DEFAULT_RESET_TABLES,
  resetSession,
  toResetError,
} from "@/lib/auth/reset.ts";
export type {
  SessionResetFailure,
  SessionResetInput,
  SessionResetResult,
  SessionResetStep,
} from "@/lib/auth/reset.ts";
export type {
  RefreshCoordinator,
  RefreshCoordinatorOptions,
  RefreshLock,
} from "@/lib/auth/refresh.ts";
export {
  browserSessionStorage,
  clearReturnTo,
  consumeReturnTo,
  rememberReturnTo,
  RETURN_TO_KEY,
  safeReturnTo,
} from "@/lib/auth/return-to.ts";
export type { ReturnToStorage } from "@/lib/auth/return-to.ts";
export type {
  LoginOptions,
  Session,
  SessionProvider,
  SessionStatus,
  SessionUser,
} from "@/lib/auth/types.ts";
