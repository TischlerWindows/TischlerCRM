import {
  Users,
  Shield,
  Building2,
  FileText,
  Trash2,
  Database,
  Briefcase,
  Home,
  Lock,
  ShieldAlert,
  Bell,
  WifiOff,
  Plug,
  Puzzle,
  Zap,
  AlertTriangle,
  LifeBuoy,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  users: Users,
  shield: Shield,
  building: Building2,
  'file-text': FileText,
  trash: Trash2,
  database: Database,
  briefcase: Briefcase,
  home: Home,
  lock: Lock,
  'shield-alert': ShieldAlert,
  bell: Bell,
  'wifi-off': WifiOff,
  plug: Plug,
  puzzle: Puzzle,
  zap: Zap,
  'alert-triangle': AlertTriangle,
  'life-buoy': LifeBuoy,
  settings: Settings2,
};

const FALLBACK: LucideIcon = Settings2;

export function getIcon(key: string): LucideIcon {
  return REGISTRY[key] ?? FALLBACK;
}

export function getIconKey(icon: LucideIcon): string | null {
  for (const [key, value] of Object.entries(REGISTRY)) {
    if (value === icon) return key;
  }
  return null;
}

export function iconKeys(): string[] {
  return Object.keys(REGISTRY);
}
