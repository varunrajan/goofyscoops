"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DogAvatar from "@/components/DogAvatar";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <DogAvatar size={80} />
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Join the pack!
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            Create an account to get started
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
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
            >
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
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-goofy-teal text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-goofy-teal/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-foreground/60">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-goofy-teal font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
