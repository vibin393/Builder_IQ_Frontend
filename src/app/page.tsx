"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { tokenStore } from "@/lib/api";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    router.replace(tokenStore.access ? "/dashboard" : "/login");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--fg-subtle)" }}>
      Corman CMS…
    </main>
  );
}
