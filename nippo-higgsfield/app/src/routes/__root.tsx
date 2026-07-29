import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportHiggsfieldError } from "../lib/higgsfield-error-reporting";
// Page metadata (browser <title>/favicon + social og: tags) committed into the
// repo by the marketplace meta API and read at BUILD time — no runtime fetch.
import appMetaJson from "../app-meta.json";

declare const __HF_DESIGN_INSPECTOR__: boolean;

const DEFAULT_TITLE = "作業日報";
const DEFAULT_DESCRIPTION = "現場作業日報の入力・集計";

type AppMeta = {
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  favicon_url?: string | null;
  og_video_url?: string | null;
};

const appMeta = appMetaJson as AppMeta;

const APP_HOST_ZONES = ["higgsfield.app", "higgsfield-dev.app"];

function toOwnAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const u = new URL(value);
    const isAppHost = APP_HOST_ZONES.some(
      (zone) => u.hostname === zone || u.hostname.endsWith(`.${zone}`),
    );
    if (isAppHost) return u.pathname + u.search;
    return value;
  } catch {
    return value;
  }
}

function buildHead(meta: AppMeta) {
  const title = meta.og_title ?? DEFAULT_TITLE;
  const description = meta.og_description ?? DEFAULT_DESCRIPTION;
  const ogImage = toOwnAssetUrl(meta.og_image_url);
  const favicon = toOwnAssetUrl(meta.favicon_url) ?? "/icons/icon-192.png";

  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title },
      { name: "description", content: description },
      // 社内業務ツールのため全ページnoindex
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "theme-color", content: "#0284c7" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(ogImage ? [{ property: "og:image", content: ogImage }] : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: favicon },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  };
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-4xl font-bold text-slate-300">404</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-slate-600">URLをご確認ください。</p>
        <Link
          to="/"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-700"
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportHiggsfieldError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">画面を表示できませんでした</h1>
        <p className="mt-2 text-sm text-slate-600">電波の良い場所でもう一度お試しください。</p>
        <button
          onClick={() => reset()}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-700"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => buildHead(appMeta),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" style={{ colorScheme: "light" }}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (!__HF_DESIGN_INSPECTOR__) {
      return;
    }
    void import("../module/design-inspector/runtime")
      .then(({ installHiggsfieldDesignInspector }) => {
        installHiggsfieldDesignInspector();
      })
      .catch((error) => {
        reportHiggsfieldError(
          error instanceof Error ? error : new Error("Failed to load design inspector"),
          { boundary: "higgsfield_design_inspector_import" },
        );
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
