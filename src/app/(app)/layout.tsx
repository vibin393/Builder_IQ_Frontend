import { AppShell } from "@/components/AppShell";
import { GuideModeLayer } from "@/components/Guide";
import { ToastProvider } from "@/components/Toast";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
      {/* Mounted once: intercepts clicks while guide mode is on, and shows the card. */}
      <GuideModeLayer />
    </ToastProvider>
  );
}
