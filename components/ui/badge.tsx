import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center border rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary/10 text-primary border-primary/50",
                secondary:
                    "bg-muted text-muted-foreground border-border",
                destructive:
                    "bg-destructive/10 text-destructive border-destructive/50",
                warning:
                    "bg-warning/10 text-warning border-warning/50",
                success:
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/50",
                outline:
                    "text-foreground border-border bg-muted/30",
            },
            size: {
                default: "px-4 py-1 text-xs font-bold",
                sm: "px-2 py-0.5 text-[10px] font-bold",
                lg: "px-4 py-2 text-sm font-bold",
            }
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, size, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
