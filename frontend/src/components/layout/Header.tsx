// frontend/src/components/layout/Header.tsx
// Global navigation (Figma: Mars Explorer header).
// Uses react-router links so navigating between pages keeps the
// in-memory MissionContext state (plain <a href> caused full reloads).
import { Component } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";

interface HeaderState {
    menuOpen: boolean;
}

const NAV_ITEMS = [
    { to: "/", label: "Home", end: true },
    { to: "/explorer", label: "Explore", end: false },
    { to: "/mission", label: "Mission", end: false },
    { to: "/mission/simulate", label: "Marswalk", end: false },
    { to: "/#about", label: "About", end: true },
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

class Header extends Component<{}, HeaderState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            menuOpen: false
        };

        this.toggleMenu = this.toggleMenu.bind(this);
    }

    toggleMenu(): void {
        this.setState({
            menuOpen: !this.state.menuOpen
        });
    }

    render() {
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
                        {NAV_ITEMS.map((item) =>
                            item.to.includes("#") ? (
                                <Link key={item.label} to={item.to} className="mx-navlink">
                                    {item.label}
                                </Link>
                            ) : (
                                <NavLink
                                    key={item.label}
                                    to={item.to}
                                    end={item.end}
                                    className="mx-navlink"
                                >
                                    {item.label}
                                </NavLink>
                            )
                        )}
                        <Link to="/explorer" className="mx-btn mx-btn--primary mx-btn--sm ml-2">
                            Get Started
                            <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        type="button"
                        onClick={this.toggleMenu}
                        className="mx-icon-btn lg:hidden"
                        aria-expanded={this.state.menuOpen}
                        aria-label="Toggle navigation menu"
                    >
                        {this.state.menuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {this.state.menuOpen && (
                    <nav
                        className="flex flex-col gap-1 border-t border-mx-border bg-mx-bg px-5 py-4 lg:hidden"
                        aria-label="Primary mobile"
                    >
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.label}
                                to={item.to}
                                onClick={this.toggleMenu}
                                className="rounded px-2 py-2.5 text-sm text-mx-muted no-underline hover:bg-mx-panel hover:text-mx-text"
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            to="/explorer"
                            onClick={this.toggleMenu}
                            className="mx-btn mx-btn--primary mt-2"
                        >
                            Get Started
                        </Link>
                    </nav>
                )}
            </header>
        );
    }
}

export default Header;
