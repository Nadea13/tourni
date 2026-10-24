import * as React from "react"

import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  size?: "default" | "sm"
  variant?: "default" | "destructive"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size = "default", variant = "default", ...props }, ref) => {
    const isDestructive = variant === "destructive"

    return (
      <textarea
        data-slot="textarea"
        data-size={size}
        data-variant={variant}
        className={cn(
          "rounded-sm placeholder:text-muted-foreground w-full min-w-0 border transition-all duration-500 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 font-medium",
          size === "sm"
            ? "px-2 py-1.5 text-xs font-semibold"
            : "px-3 py-2 text-base md:text-sm",
          isDestructive
            ? "bg-[linear-gradient(var(--color-destructive),var(--color-destructive))] selection:bg-destructive selection:text-destructive-foreground focus:border-destructive/40"
            : "bg-[linear-gradient(var(--color-primary),var(--color-primary))] selection:bg-primary selection:text-primary-foreground focus:border-border",
          "bg-[length:0%_2px] bg-no-repeat bg-[position:bottom_left] focus-visible:bg-[length:100%_2px]",
          "focus:ring-0 focus:bg-muted/5",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:bg-[linear-gradient(var(--color-destructive),var(--color-destructive))]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
export type { TextareaProps }
