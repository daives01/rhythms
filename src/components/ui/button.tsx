import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes } from "react"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap font-medium",
    "transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "hover:bg-primary-glow hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.5)]",
          "border border-primary-deep/50",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90",
        ].join(" "),
        outline: [
          "border-2 border-border bg-transparent",
          "hover:border-primary/50 hover:bg-primary/5",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground border border-border",
          "hover:bg-muted hover:border-primary/30",
        ].join(" "),
        ghost: [
          "hover:bg-muted hover:text-foreground",
        ].join(" "),
        link: [
          "text-primary underline-offset-4 hover:underline",
        ].join(" "),
      },
      size: {
        default: "h-11 px-5 py-2 rounded-xl text-sm",
        sm: "h-9 px-4 rounded-lg text-sm",
        lg: "h-12 px-8 rounded-xl text-base",
        xl: "h-14 px-10 rounded-2xl text-lg font-semibold tracking-wide",
        icon: "h-11 w-11 rounded-xl",
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
