import { cn } from '@/lib/utils';

interface SettingsContentCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsContentCard({ children, className }: SettingsContentCardProps) {
  return (
    <div
      className={cn(
        'mx-8 my-6 bg-white rounded-[14px] border border-[#e5e5e5] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]',
        className
      )}
    >
      {children}
    </div>
  );
}