import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { error?: boolean };

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, error, ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      className={cn(
        "h-12 w-full rounded-xl border-2 bg-white px-4 text-[15px] text-ink placeholder:text-ink-soft/70 outline-none transition-all",
        "focus:border-peach-deep focus:bg-cream/30",
        error ? "border-bubblegum" : "border-ink/10",
        className,
      )}
    />
  ),
);
Input.displayName = "Input";
