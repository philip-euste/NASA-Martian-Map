// frontend/src/components/ui/index.tsx
// Small shared presentation components used across the explorer and
// mission workspaces. Styling lives in src/styles/theme.css.
import type { ReactNode } from "react";
import { ImageOff } from "lucide-react";

/* ---------------------------------------------------------
   DataField — Figma "ELEVATION / -2,450 m" label/value pair
   --------------------------------------------------------- */

export function DataField({
  label,
  value,
  fallback = "Not available",
  className = "",
}: {
  label: string;
  value?: ReactNode;
  fallback?: string;
  className?: string;
}) {
  const missing = value === undefined || value === null || value === "";

  return (
    <div className={className}>
      <div className="mx-field__label">{label}</div>
      <div
        className={`mx-field__value ${missing ? "mx-field__value--muted" : ""}`}
      >
        {missing ? fallback : value}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   EmptyState — explicit "no data yet" messaging. Used instead
   of placeholder/fake content wherever mission data is empty.
   --------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  children,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-[10px] border border-dashed border-mx-border-strong text-center ${
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10"
      }`}
    >
      {icon && <div className="text-mx-dim">{icon}</div>}
      <p className="m-0 font-display text-[15px] font-semibold text-mx-text">
        {title}
      </p>
      {children && (
        <div className="mx-body m-0 max-w-md text-[13px]">{children}</div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   ImagePending — shown where scientific imagery has not been
   supplied by the team. Never substitute generic images.
   --------------------------------------------------------- */

export function ImagePending({
  label = "Imagery not yet provided",
  detail,
  className = "",
}: {
  label?: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-mx-border-strong bg-[repeating-linear-gradient(135deg,#1a181c_0_12px,#1d1b1f_12px_24px)] p-6 text-center ${className}`}
    >
      <ImageOff size={22} className="text-mx-dim" aria-hidden="true" />
      <span className="mx-eyebrow">{label}</span>
      {detail && <span className="max-w-xs text-xs text-mx-dim">{detail}</span>}
    </div>
  );
}

/* ---------------------------------------------------------
   SectionHeading — consistent titles inside pages/panels
   --------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mx-eyebrow mb-2">{eyebrow}</div>}
        <h2 className="mx-heading m-0 flex items-center gap-2 text-lg">
          {icon && <span className="text-mx-accent">{icon}</span>}
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------
   Formatting helpers
   --------------------------------------------------------- */

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}

export function formatDistance(meters?: number): string | undefined {
  if (meters === undefined) return undefined;
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}
