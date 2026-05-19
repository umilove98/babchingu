import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-10 h-10",
  lg: "w-16 h-16",
};

export function Avatar({
  seed,
  url,
  size = "md",
  className,
  ring = true,
}: {
  seed: string;
  url?: string | null;
  size?: Size;
  className?: string;
  ring?: boolean;
}) {
  // 업로드된 이미지가 있으면 우선 사용, 아니면 DiceBear 시드 기반 생성
  const src = url
    ? url
    : `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(
        seed,
      )}&backgroundColor=ffe6a7,b8e6cf,ffd3b6,c5baff,b6e5ff,ffb6c8&radius=50`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={seed}
      className={cn(
        "inline-block rounded-full bg-white/70 object-cover",
        ring && "ring-2 ring-white",
        sizeMap[size],
        className,
      )}
      draggable={false}
    />
  );
}

export function AvatarStack({
  seeds,
  size = "sm",
  max = 5,
}: {
  seeds: string[];
  size?: Size;
  max?: number;
}) {
  const shown = seeds.slice(0, max);
  const extra = seeds.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((s) => (
          <Avatar key={s} seed={s} size={size} ring />
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-xs text-ink-soft font-medium">
          +{extra}
        </span>
      )}
    </div>
  );
}
