import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { error?: boolean };

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, error, ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      className={cn(
        "h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-ink-soft/60 outline-none transition-colors",
        "focus:border-ink/60",
        error ? "border-bubblegum" : "border-ink/15",
        className,
      )}
    />
  ),
);
Input.displayName = "Input";
