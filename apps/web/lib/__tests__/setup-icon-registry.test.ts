import { getIcon, getIconKey, iconKeys } from '@/lib/setup-icon-registry';
import { Users, Shield } from 'lucide-react';

describe('setup-icon-registry', () => {
  it('returns the correct icon component for a known key', () => {
    expect(getIcon('users')).toBe(Users);
    expect(getIcon('shield')).toBe(Shield);
  });

  it('returns a fallback icon for an unknown key', () => {
    const fallback = getIcon('not-a-real-key');
    expect(typeof fallback).toBe('object');
  });

  it('round-trips an icon component to a key and back', () => {
    const key = getIconKey(Users);
    expect(key).toBe('users');
    expect(getIcon(key!)).toBe(Users);
  });

  it('exposes the list of registered keys', () => {
    expect(iconKeys()).toContain('users');
    expect(iconKeys()).toContain('shield');
  });
});
