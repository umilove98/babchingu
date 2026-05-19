import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "soft" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-peach text-white hover:bg-peach-deep active:scale-[0.98]",
  soft:
    "bg-butter text-peach-deep hover:bg-butter-deep active:scale-[0.98]",
  ghost:
    "bg-transparent text-ink-soft hover:text-ink hover:bg-cream-deep",
  danger:
    "bg-bubblegum text-white hover:opacity-90 active:scale-[0.98]",
  outline:
    "bg-white text-ink border border-ink/15 hover:bg-cream-deep hover:border-ink/30",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-[15px] rounded-xl",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...rest }, ref) => (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    />
  ),
);
Button.displayName = "Button";
