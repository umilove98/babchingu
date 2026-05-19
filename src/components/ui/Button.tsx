import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "soft" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-peach text-ink hover:bg-peach-deep hover:text-white shadow-[0_4px_0_0_rgba(74,74,107,0.18)] active:translate-y-1 active:shadow-[0_0_0_0_rgba(74,74,107,0.18)]",
  soft:
    "bg-cream-deep text-ink hover:bg-butter shadow-[0_3px_0_0_rgba(74,74,107,0.12)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(74,74,107,0.12)]",
  ghost:
    "bg-transparent text-ink hover:bg-cream-deep/80",
  danger:
    "bg-bubblegum text-white hover:opacity-90 shadow-[0_3px_0_0_rgba(74,74,107,0.18)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(74,74,107,0.18)]",
  outline:
    "bg-white text-ink border-2 border-ink/15 hover:border-ink/30",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-xl",
  md: "h-11 px-5 text-[15px] rounded-xl",
  lg: "h-14 px-7 text-base rounded-2xl",
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
