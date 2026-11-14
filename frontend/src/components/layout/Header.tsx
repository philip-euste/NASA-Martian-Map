
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, Menu, X, WifiOff, AlertTriangle, Database } from "lucide-react";
import { useAuth } from "../../features/auth/AuthProvider";
import { useConnectionStatus } from "../../services/connectionStatus";

const NAV_ITEMS = [
    { to: "/", label: "Home", end: true },
    { to: "/explorer", label: "Explore", end: false },
    { to: "/mission", label: "Mission", end: false },
    { to: "/mission/simulate", label: "Marswalk", end: false },
];

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M2.5 15.5C5 17.5 19.5 10 21.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConnectionStatusIndicator() {
  const status = useConnectionStatus();

  if (!status.networkOnline) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-mono text-red-200"
        role="status"
        aria-live="polite"
        title="No internet connection detected. Using cached imagery and local Jezero Crater DEM data."
      >
        <WifiOff size={12} className="shrink-0 text-red-300" aria-hidden="true" />
        <span>Offline · Local Data Mode</span>
      </div>
    );
  }

  if (status.nasaWmtsStatus === "degraded" || status.nasaWmtsStatus === "offline") {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-200"
        role="status"
        aria-live="polite"
        title={
          status.nasaWmtsMessage ??
          "Internet connection is active, but the NASA Mars Trek WMTS imagery service is slow or temporarily unavailable."
        }
      >
        <AlertTriangle
          size={12}
          className="shrink-0 text-amber-300"
          aria-hidden="true"
        />
        <span>NASA Trek Service Degraded</span>
      </div>
    );
  }

  if (status.backendStatus === "fallback") {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-mx-border-strong bg-mx-panel px-2.5 py-1 text-[11px] font-mono text-mx-muted"
        role="status"
        aria-live="polite"
        title={
          status.backendMessage ??
          "Backend DEM API is offline; using verified local USGS/NASA CTX DEM for Jezero Crater."
        }
      >
        <Database
          size={12}
          className="shrink-0 text-mx-accent"
          aria-hidden="true"
        />
        <span>Local Jezero DEM Active</span>
      </div>
    );
  }

  if (status.backendStatus === "offline") {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-200"
        role="status"
        aria-live="polite"
        title={
          status.backendMessage ??
          "Internet is connected, but the local FastAPI backend server is unreachable."
        }
      >
        <AlertTriangle
          size={12}
          className="shrink-0 text-amber-300"
          aria-hidden="true"
        />
        <span>Backend API Offline</span>
      </div>
    );
  }

  if (status.backendStatus === "online" || status.nasaWmtsStatus === "online") {
    return (
      <div
        className="hidden items-center gap-1.5 rounded-full border border-mx-border bg-mx-panel/70 px-2.5 py-1 text-[11px] font-mono text-mx-dim xl:inline-flex"
        role="status"
        aria-live="polite"
        title="NASA Mars Trek WMTS and elevation services are connected."
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          aria-hidden="true"
        />
        <span>NASA Data Connected</span>
      </div>
    );
  }

  return null;
}

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, signOut } = useAuth();

    async function handleSignOut() {
        try {
            await signOut();
            setMenuOpen(false);
        } catch (error) {
            console.error("Unable to sign out:", error);
        }
    }

    function closeMenu() {
        setMenuOpen(false);
    }

    return (
        <header className="sticky top-0 z-[1100] border-b border-mx-border bg-mx-bg/95 backdrop-blur-md">
            <div className="mx-auto flex h-[var(--mx-header-height)] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">

                {/* Logo & Live Data Connection Status */}
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2.5 text-mx-text no-underline"
                        aria-label="Mars Explorer home"
                    >
                        <BrandMark className="text-mx-accent" />
                        <span className="font-display text-[15px] font-semibold uppercase tracking-[0.14em]">
                            Mars Explorer
                        </span>
                    </Link>
                    <div className="hidden md:block">
                        <ConnectionStatusIndicator />
                    </div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.label}
                            to={item.to}
                            end={item.end}
                            className="mx-navlink"
                        >
                            {item.label}
                        </NavLink>
                    ))}

                    {/* Authentication replaces About */}
                    {user ? (
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="mx-navlink"
                        >
                            Log Out
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            className="mx-navlink"
                        >
                            Log In
                        </Link>
                    )}

                    <Link to="/explorer" className="mx-btn mx-btn--primary mx-btn--sm">
                        Get Started
                        <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                </nav>

                {/* Mobile Menu Button */}
                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="mx-icon-btn lg:hidden"
                    aria-expanded={menuOpen}
                    aria-label="Toggle navigation menu"
                >
                    {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>

            {/* Mobile Navigation */}
            {menuOpen && (
                <nav
                    className="flex flex-col gap-1 border-t border-mx-border bg-mx-bg px-5 py-4 lg:hidden"
                    aria-label="Primary mobile"
                >
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.label}
                            to={item.to}
                            end={item.end}
                            onClick={closeMenu}
                            className="rounded px-2 py-2.5 text-sm text-mx-muted no-underline hover:bg-mx-panel hover:text-mx-text"
                        >
                            {item.label}
                        </NavLink>
                    ))}

                    {user ? (
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="mx-btn mt-2"
                        >
                            Log Out
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            onClick={closeMenu}
                            className="mx-btn mt-2"
                        >
                            Log In
                        </Link>
                    )}

                    <Link
                        to="/explorer"
                        onClick={closeMenu}
                        className="mx-btn mx-btn--primary mt-2"
                    >
                        Get Started
                    </Link>
                </nav>
            )}
        </header>
    );
}
