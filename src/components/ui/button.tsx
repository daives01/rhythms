import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes } from "react"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap font-medium",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-foreground text-background",
          "hover:bg-foreground/90",
          "border border-foreground",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90",
          "border border-destructive",
        ].join(" "),
        outline: [
          "border border-border bg-transparent text-foreground",
          "hover:border-foreground/50 hover:bg-foreground/5",
        ].join(" "),
        secondary: [
          "bg-muted text-foreground border border-border",
          "hover:bg-muted/80 hover:border-foreground/30",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
        ].join(" "),
        link: [
          "text-foreground underline-offset-4 hover:underline",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2 text-sm",
        sm: "h-8 px-4 text-xs",
        lg: "h-11 px-8 text-sm",
        xl: "h-12 px-10 text-base font-semibold tracking-wide",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
