"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DogAvatar from "@/components/DogAvatar";

type JoinStep = "form" | "joining" | "done" | "error";

function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<JoinStep>("form");
  const [error, setError] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);

  // If the user is already authenticated (e.g. came back from login), auto-join
  useEffect(() => {
    if (!token) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        joinHousehold(token);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function joinHousehold(inviteToken: string) {
    setStep("joining");
    const supabase = createClient();

    const { data, error } = await supabase.rpc("join_household_by_token", {
      token: inviteToken,
    });

    if (error) {
      setError(error.message);
      setStep("error");
      return;
    }

    // Clear the pending invite cookie now that we've joined
    document.cookie = "pending_invite_token=;path=/;max-age=0";

    setHouseholdName(data.household_name);
    setStep("done");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();

    // Persist the token in a cookie so the middleware can redirect back here
    // even if the auth flow involves a full page navigation or email confirmation
    document.cookie = `pending_invite_token=${token};path=/;max-age=86400;SameSite=Lax`;

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/join?token=${token}`)}`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError(
          "Check your email to confirm your account, then come back to this link."
        );
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    await joinHousehold(token);
  }

  if (!token) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
          <DogAvatar size={80} />
          <h1 className="text-2xl font-extrabold">Invalid Invite Link</h1>
          <p className="text-sm text-foreground/60">
            This link is missing an invite token. Ask your partner to send you a
            new one.
          </p>
          <Link
            href="/login"
            className="text-goofy-teal font-semibold hover:underline"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  if (step === "joining") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
          <DogAvatar size={80} />
          <p className="text-lg font-bold text-foreground/60">
            Joining household…
          </p>
        </div>
      </main>
    );
  }

  if (step === "done") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <DogAvatar size={100} />
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">
              You&apos;re in!
            </h1>
            <p className="text-base text-foreground/70 mt-2">
              Welcome to <span className="font-bold">{householdName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="w-full max-w-xs bg-goofy-teal text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-goofy-teal/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (step === "error") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
          <DogAvatar size={80} />
          <h1 className="text-2xl font-extrabold">Uh oh!</h1>
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <Link
            href="/login"
            className="text-goofy-teal font-semibold hover:underline"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <DogAvatar size={80} />
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Join Goofy Scoops!
          </h1>
          <p className="text-sm text-foreground/70 mt-2">
            You&apos;ve been invited to help track meals!
          </p>
          <p className="text-xs text-foreground/50 mt-1">
            {isLogin ? "Sign in" : "Sign up"} to join the household
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-4"
        >
          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-goofy-teal/20 rounded-xl px-4 py-3 text-sm bg-transparent focus:border-goofy-teal outline-none transition-colors"
              placeholder="good-boy@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-goofy-teal/20 rounded-xl px-4 py-3 text-sm bg-transparent focus:border-goofy-teal outline-none transition-colors"
              placeholder={isLogin ? "••••••••" : "At least 6 characters"}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-goofy-teal text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-goofy-teal/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading
              ? isLogin
                ? "Signing in…"
                : "Creating account…"
              : "Join Household"}
          </button>
        </form>

        <p className="text-sm text-foreground/60">
          {isLogin ? (
            <>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(null); }}
                className="text-goofy-teal font-semibold hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(null); }}
                className="text-goofy-teal font-semibold hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh flex items-center justify-center px-4">
          <p className="text-foreground/50 font-medium">Loading…</p>
        </main>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
