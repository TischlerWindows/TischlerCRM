import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export function Toast({ className, variant = 'default', ...props }: ToastProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
        variant === 'default' && "bg-background text-foreground",
        variant === 'destructive' && "destructive group border-destructive bg-destructive text-destructive-foreground",
        className
      )}
      {...props}
    />
  );
}