// frontend/src/components/layout/AppLayout.tsx
// Shared page frame: global header, page content and optional footer.
import type { ReactNode } from "react";
import Header from "./Header";

interface AppLayoutProps {
  children: ReactNode;
  /** Full-viewport tools (maps, globe) hide the footer and lock scrolling. */
  fullscreen?: boolean;
  footer?: ReactNode;
  theme?: boolean;
}

export default function AppLayout({
  children,
  fullscreen = false,
  footer,
  theme = true,
}: AppLayoutProps) {
  if (fullscreen) {
    return (
      <div className={`${theme ? "mx-app-theme " : ""}flex h-screen min-h-[560px] flex-col overflow-hidden bg-mx-bg`}>
        <Header />
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className={`${theme ? "mx-app-theme " : ""}flex min-h-screen flex-col bg-mx-bg`}>
      <Header />
      <div className="flex-1">{children}</div>
      {footer ?? <SiteFooter />}
    </div>
  );
}

export function SiteFooter({
  left = "Mars Explorer",
  right = "Data: NASA / JPL-Caltech / USGS",
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <footer className="mx-no-print border-t border-mx-border">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
        <span className="mx-eyebrow text-mx-dim">{left}</span>
        <span className="mx-eyebrow text-mx-dim">{right}</span>
      </div>
    </footer>
  );
}
