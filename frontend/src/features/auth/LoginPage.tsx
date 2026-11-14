
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const destination = location.state?.from?.pathname || "/";

    useEffect(() => {
        if (user) {
            navigate("/", { replace: true });
        }
    }, [user, navigate]);

    if (user) return null;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (signInError) throw signInError;

            navigate(destination, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to sign in.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main style={styles.page}>
            <form onSubmit={handleSubmit} style={styles.card}>
                <h1 style={styles.title}>Sign in</h1>
                <p style={styles.description}>
                    Sign in to save and access your Mars exploration missions.
                </p>

                <label style={styles.label} htmlFor="email">Email address</label>
                <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    style={styles.input}
                />

                <label style={styles.label} htmlFor="password">Password</label>
                <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    style={styles.input}
                />

                {error && <p style={styles.error}>{error}</p>}

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? "Signing in..." : "Sign in"}
                </button>

                <p style={styles.footer}>
                    Don't have an account? <Link to="/register">Create one</Link>
                </p>

                <Link to="/" style={styles.backLink}>
                    Continue without signing in
                </Link>
            </form>
        </main>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
    } as const,
    card: {
        width: "100%",
        maxWidth: "420px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "32px",
        border: "1px solid #444",
        borderRadius: "12px",
    } as const,
    title: { margin: 0 } as const,
    description: { opacity: 0.7, marginTop: 0 } as const,
    label: { fontSize: "14px", fontWeight: 600 } as const,
    input: {
        padding: "12px",
        border: "1px solid #666",
        borderRadius: "6px",
        fontSize: "15px",
    } as const,
    button: {
        padding: "12px",
        border: 0,
        borderRadius: "6px",
        cursor: "pointer",
        fontWeight: 600,
    } as const,
    error: { color: "#dc5555", fontSize: "14px" } as const,
    footer: { fontSize: "14px", textAlign: "center" } as const,
    backLink: { fontSize: "13px", textAlign: "center" } as const,
};
