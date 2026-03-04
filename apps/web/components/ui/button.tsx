import { cn } from "@/lib/utils";
import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const buttonVariants = {
  variant: {
    default: "bg-brand-navy text-white hover:bg-brand-navy-dark",
    destructive: "bg-brand-red text-white hover:bg-red-700",
    outline: "border border-gray-300 bg-white hover:bg-brand-light hover:text-brand-navy text-brand-dark",
    secondary: "bg-[#e8eaf6] text-brand-navy hover:bg-[#d4d8f0]",
    ghost: "hover:bg-[#f0f1fa] hover:text-brand-navy text-brand-dark",
    link: "text-brand-navy underline-offset-4 hover:underline hover:text-brand-red"
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  }
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";