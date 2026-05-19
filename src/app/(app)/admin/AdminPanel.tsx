"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type User = {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  canHost: boolean;
  isAdmin: boolean;
  createdAt: string;
};

export function AdminPanel({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const [issuedPassword, setIssuedPassword] = useState<{ username: string; password: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("불러오기 실패");
      return res.json() as Promise<{ users: User[] }>;
    },
  });

  const createUser = useMutation({
    mutationFn: async (payload: { username: string; displayName: string; password?: string; canHost: boolean; isAdmin: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "발급 실패");
      return body as { user: { username: string }; initialPassword?: string };
    },
    onSuccess: (body) => {
      if (body.initialPassword) {
        setIssuedPassword({ username: body.user.username, password: body.initialPassword });
      }
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const patchUser = useMutation({
    mutationFn: async (payload: { id: string } & Partial<Pick<User, "canHost" | "isAdmin">> & { resetPassword?: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "변경 실패");
      return body as { ok: true; newPassword?: string };
    },
    onSuccess: (body, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      if (body.newPassword) {
        const u = data?.users.find((x) => x.id === vars.id);
        if (u) setIssuedPassword({ username: u.username, password: body.newPassword });
      }
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "삭제 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div className="space-y-6">
      <CreateUserCard
        onSubmit={(d) => createUser.mutate(d)}
        loading={createUser.isPending}
        error={createUser.error?.message}
      />

      {issuedPassword && (
        <div className="bg-mint p-4 rounded-xl shadow-pop-sm border-2 border-white">
          <p className="text-sm font-semibold mb-1">✨ 비밀번호가 발급되었어요</p>
          <p className="text-sm">
            <strong>{issuedPassword.username}</strong> 님에게 아래 비밀번호를 전달해 주세요:
          </p>
          <code className="block mt-2 bg-white px-3 py-2 rounded-xl font-mono text-base text-ink select-all">
            {issuedPassword.password}
          </code>
          <button
            onClick={() => setIssuedPassword(null)}
            className="text-xs text-ink-soft mt-2 hover:text-ink"
          >
            닫기
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-pop border-2 border-white overflow-hidden">
        <div className="px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">👥 사용자 목록</h2>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-ink-soft">불러오는 중…</p>
        ) : (
          <ul className="divide-y divide-cream-deep">
            {data?.users.map((u) => (
              <li key={u.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <Avatar seed={u.avatarSeed} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{u.displayName}</span>
                    <span className="text-xs text-ink-soft">@{u.username}</span>
                    {u.isAdmin && <Tag color="lavender">관리자</Tag>}
                    {u.canHost && <Tag color="butter">호스트</Tag>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleChip
                    on={u.canHost}
                    onClick={() => patchUser.mutate({ id: u.id, canHost: !u.canHost })}
                    label={u.canHost ? "호스트 ON" : "호스트 OFF"}
                  />
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => {
                      if (confirm(`${u.displayName} 님 비밀번호를 새로 발급할까요?`)) {
                        patchUser.mutate({ id: u.id, resetPassword: true });
                      }
                    }}
                  >
                    🔑 비번 재발급
                  </Button>
                  {u.id !== myId && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`정말 ${u.displayName} 님 계정을 삭제할까요? 모든 데이터가 함께 지워져요.`)) {
                          deleteUser.mutate(u.id);
                        }
                      }}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreateUserCard({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (d: { username: string; displayName: string; password?: string; canHost: boolean; isAdmin: boolean }) => void;
  loading: boolean;
  error?: string;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [canHost, setCanHost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          username, displayName,
          password: password || undefined,
          canHost, isAdmin,
        });
        setUsername(""); setDisplayName(""); setPassword("");
        setCanHost(false); setIsAdmin(false);
      }}
      className="bg-white rounded-2xl shadow-pop border-2 border-white p-5"
    >
      <h2 className="font-display font-bold text-xl mb-4">✏️ 새 계정 발급</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-soft px-1">아이디</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="예: jiwon" required />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-soft px-1">표시 이름</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="예: 지원" required />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-ink-soft px-1">비밀번호 (비우면 자동 생성)</label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="자동 생성" />
        </div>
      </div>
      <div className="flex gap-3 mt-4 flex-wrap items-center">
        <Checkbox checked={canHost} onChange={setCanHost} label="🍜 외식 등록 권한" />
        <Checkbox checked={isAdmin} onChange={setIsAdmin} label="🛠 관리자 권한" />
      </div>
      {error && <p className="text-bubblegum text-sm mt-3">🙀 {error}</p>}
      <Button type="submit" disabled={loading} className="mt-4">
        {loading ? "발급 중…" : "발급하기 ✨"}
      </Button>
    </form>
  );
}

function Tag({ color, children }: { color: "lavender" | "butter"; children: React.ReactNode }) {
  const c =
    color === "lavender"
      ? "bg-lavender/30 text-ink"
      : "bg-butter text-ink";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c}`}>{children}</span>;
}

function ToggleChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full font-bold transition ${on ? "bg-mint text-ink" : "bg-cream-deep text-ink-soft hover:bg-cream"}`}
    >
      {label}
    </button>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-peach-deep"
      />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}
