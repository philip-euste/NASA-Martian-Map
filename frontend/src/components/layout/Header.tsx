
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useAuth } from "../../features/auth/AuthProvider";

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
        <header className="relative z-[1100] border-b border-mx-border bg-mx-bg/95 backdrop-blur">
            <div className="mx-auto flex h-[var(--mx-header-height)] max-w-[1440px] items-center justify-between px-5 sm:px-8">

                {/* Logo */}
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

                {/* Desktop Navigation */}
                <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
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
