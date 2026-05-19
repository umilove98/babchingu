"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "로그인에 실패했어요");
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했어요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 bg-white/80 backdrop-blur p-6 rounded-2xl shadow-[0_6px_0_0_rgba(74,74,107,0.1)] border-2 border-white"
    >
      <div>
        <label className="text-xs font-semibold text-ink-soft block mb-1.5 px-1">아이디</label>
        <Input
          autoFocus
          autoComplete="username"
          placeholder="발급받은 아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-soft block mb-1.5 px-1">비밀번호</label>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          error={Boolean(error)}
        />
      </div>
      {error && (
        <p className="text-bubblegum text-sm font-medium text-center animate-wiggle">
          🙀 {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
        {loading ? "들어가는 중…" : "들어가기 🍙"}
      </Button>
    </form>
  );
}
