
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

export default function RegisterPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) navigate("/", { replace: true });
    }, [user, navigate]);

    if (user) return null;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setMessage("");

        if (password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/`,
                },
            });

            if (signUpError) throw signUpError;

            if (data.session) {
                navigate("/", { replace: true });
            } else {
                setMessage(
                    "Registration successful. Check your email for the confirmation link before signing in."
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to register.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main style={styles.page}>
            <form onSubmit={handleSubmit} style={styles.card}>
                <h1 style={styles.title}>Create an account</h1>
                <p style={styles.description}>
                    Create an account to save your Mars exploration missions.
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
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    style={styles.input}
                />

                <label style={styles.label} htmlFor="confirmPassword">Confirm password</label>
                <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter your password again"
                    style={styles.input}
                />

                {error && <p style={styles.error}>{error}</p>}
                {message && <p style={styles.message}>{message}</p>}

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? "Creating account..." : "Create account"}
                </button>

                <p style={styles.footer}>
                    Already registered? <Link to="/login">Sign in</Link>
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
    message: { color: "#269b67", fontSize: "14px" } as const,
    footer: { fontSize: "14px", textAlign: "center" } as const,
    backLink: { fontSize: "13px", textAlign: "center" } as const,
};
