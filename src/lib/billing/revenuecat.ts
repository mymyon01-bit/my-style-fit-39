/**
 * In-app subscriptions for the AppBuild wrapper build.
 *
 * AppBuild compiles the RevenueCat native plugin into the wrapper, and the
 * wrapper SDK snippet in index.html exposes it over the postMessage bridge as
 * `window.AppbuildWrapper.plugin("Purchases")` (the @revenuecat/purchases-*
 * plugin name). There is no npm package and no API key in this codebase —
 * the RevenueCat project/API key is configured in the AppBuild + RevenueCat
 * dashboards.
 *
 * Every helper is a no-op on the plain web build, so the site keeps working
 * unchanged in a normal browser.
 */
import { supabase } from "@/integrations/supabase/client";

export const PREMIUM_ENTITLEMENT = "premium";

export type StorePackage = {
  identifier: string;
  packageType: string;
  productId: string;
  title: string;
  description: string;
  priceString: string;
  period: string | null;
  raw: unknown;
};

export type CustomerInfo = {
  activeEntitlements: string[];
  expiresAt: string | null;
  willRenew: boolean;
  productId: string | null;
  appUserId: string | null;
  raw: unknown;
};

type BridgePlugin = Record<string, (...args: unknown[]) => Promise<any>>;

type AppbuildWrapperLike = {
  ready: Promise<unknown>;
  appInfo: unknown;
  plugin: (name: string) => BridgePlugin;
};

const getWrapper = (): AppbuildWrapperLike | null => {
  if (typeof window === "undefined") return null;
  const w = (window as any).AppbuildWrapper;
  return w && typeof w.plugin === "function" ? (w as AppbuildWrapperLike) : null;
};

/** True only inside the AppBuild native wrapper (iOS/Android app build). */
export const isWrapperApp = (): boolean => {
  const w = getWrapper();
  return !!w && !!w.appInfo;
};

/** Waits briefly for the wrapper bridge handshake; false in a normal browser. */
export const waitForWrapper = async (timeoutMs = 1500): Promise<boolean> => {
  const w = getWrapper();
  if (!w) return false;
  if (w.appInfo) return true;
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), timeoutMs));
  const ready = w.ready.then(() => true as const).catch(() => false as const);
  return Promise.race([ready, timeout]);
};

const purchases = (): BridgePlugin | null => getWrapper()?.plugin("Purchases") ?? null;

const normalizeCustomerInfo = (payload: any): CustomerInfo => {
  const info = payload?.customerInfo ?? payload ?? {};
  const entitlements = info?.entitlements?.active ?? {};
  const keys = Object.keys(entitlements);
  const premium = entitlements[PREMIUM_ENTITLEMENT] ?? entitlements[keys[0]];
  return {
    activeEntitlements: keys,
    expiresAt: premium?.expirationDate ?? null,
    willRenew: premium?.willRenew ?? false,
    productId: premium?.productIdentifier ?? null,
    appUserId: info?.originalAppUserId ?? null,
    raw: info,
  };
};

export const hasPremium = (info: CustomerInfo | null): boolean =>
  !!info && info.activeEntitlements.includes(PREMIUM_ENTITLEMENT);

/** Links the store purchase to the signed-in MYMYON account. */
export const identifyUser = async (userId: string, email?: string | null) => {
  const p = purchases();
  if (!p) return;
  try {
    await p.logIn({ appUserID: userId });
    if (email) await p.setEmail?.({ email });
  } catch (e) {
    console.warn("[revenuecat] logIn failed", e);
  }
};

export const logOutUser = async () => {
  const p = purchases();
  if (!p) return;
  try {
    await p.logOut();
  } catch {
    /* anonymous already */
  }
};

const normalizePackage = (pkg: any): StorePackage => ({
  identifier: pkg?.identifier ?? pkg?.product?.identifier ?? "package",
  packageType: pkg?.packageType ?? "CUSTOM",
  productId: pkg?.product?.identifier ?? "",
  title: pkg?.product?.title ?? pkg?.identifier ?? "Premium",
  description: pkg?.product?.description ?? "",
  priceString: pkg?.product?.priceString ?? "",
  period:
    pkg?.product?.subscriptionPeriod ??
    (pkg?.packageType === "ANNUAL"
      ? "/ year"
      : pkg?.packageType === "MONTHLY"
        ? "/ month"
        : null),
  raw: pkg,
});

/** Packages from the RevenueCat "current" offering. Empty array on web. */
export const getOfferings = async (): Promise<StorePackage[]> => {
  const p = purchases();
  if (!p) return [];
  const res = await p.getOfferings();
  const offering = res?.current ?? res?.offerings?.current;
  const packages: any[] = offering?.availablePackages ?? [];
  return packages.map(normalizePackage);
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  const p = purchases();
  if (!p) return null;
  try {
    return normalizeCustomerInfo(await p.getCustomerInfo());
  } catch (e) {
    console.warn("[revenuecat] getCustomerInfo failed", e);
    return null;
  }
};

export class PurchaseCancelled extends Error {}

/** Runs the native store purchase sheet. Throws PurchaseCancelled on user cancel. */
export const purchasePackage = async (pkg: StorePackage): Promise<CustomerInfo> => {
  const p = purchases();
  if (!p) throw new Error("Store not available");
  try {
    const res = await p.purchasePackage({ aPackage: pkg.raw });
    return normalizeCustomerInfo(res);
  } catch (e: any) {
    const code = String(e?.code ?? e?.data?.code ?? "");
    const msg = String(e?.message ?? "");
    if (
      e?.userCancelled ||
      e?.data?.userCancelled ||
      code.includes("PURCHASE_CANCELLED") ||
      /cancel/i.test(msg)
    ) {
      throw new PurchaseCancelled("cancelled");
    }
    throw e;
  }
};

export const restorePurchases = async (): Promise<CustomerInfo | null> => {
  const p = purchases();
  if (!p) return null;
  return normalizeCustomerInfo(await p.restorePurchases());
};

/**
 * Mirrors the store entitlement into the `subscriptions` table so the rest of
 * the app (useSubscription, FitPage, gating) keeps its single source of truth.
 */
export const syncEntitlement = async (
  userId: string,
  info: CustomerInfo | null,
): Promise<boolean> => {
  if (!info) return false;
  const premium = hasPremium(info);
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: premium ? "premium" : "free",
      status: premium ? "active" : "cancelled",
      provider: premium ? "revenuecat" : null,
      store_product_id: info.productId,
      rc_app_user_id: info.appUserId,
      current_period_end: info.expiresAt,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );
  if (error) console.error("[revenuecat] syncEntitlement failed", error);
  return premium;
};

/** Call after login / on app resume so store state wins over stale DB rows. */
export const refreshEntitlement = async (userId: string): Promise<boolean> => {
  if (!isWrapperApp()) return false;
  const info = await getCustomerInfo();
  return syncEntitlement(userId, info);
};
