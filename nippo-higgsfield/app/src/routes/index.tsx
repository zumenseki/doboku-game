import { createFileRoute, redirect } from "@tanstack/react-router";

// トップは管理画面へ。下請けは配布されたQR/URL (/r/{token}) から直接入る。
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
