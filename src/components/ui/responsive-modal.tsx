"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet-radix"

interface ResponsiveModalProps {
  children: React.ReactNode
  title: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
}

export function ResponsiveModal({
  children,
  title,
  description,
  open,
  onOpenChange,
  trigger,
}: ResponsiveModalProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent side="bottom" className="rounded-t-none">
          <SheetHeader className="text-left border-b border-border pb-4">
            <SheetTitle className="text-xs uppercase tracking-widest font-normal">
              {title}
            </SheetTitle>
            {description && (
              <SheetDescription className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>
          <div className="pt-4">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="rounded-none sm:max-w-[425px]">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xs uppercase tracking-widest font-normal">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="pt-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
