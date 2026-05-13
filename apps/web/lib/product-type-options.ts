export function getOptionsForType(t: string): string[] {
  const lo = t.toLowerCase();
  if (lo === 'pivot' || lo === 'outswing pivot' || lo.includes('convert pivot')) {
    return ['Maco Instinct Motorized Locks'];
  }
  if (lo === 'inswing folding') {
    return ['Threshold #6', '#6C', 'ADA'];
  }
  if (lo === 'outswing folding') {
    return ['Threshold #8', 'ADA'];
  }
  if (lo.includes('folding')) {
    return lo.includes('inswing')
      ? ['Threshold #6', '#6C', 'ADA']
      : ['Threshold #8', 'ADA'];
  }
  if (lo === 'l&r d') {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Standard RH', 'SS RH'];
  }
  if (lo.includes('inswing') && (lo.includes(' gd') || lo.includes(' dd') || lo.includes('house door'))) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'KFV RH', 'Siegenia RH', 'Threshold #6', '#6C', 'ADA'];
  }
  if (lo.includes('outswing') && (lo.includes(' gd') || lo.includes(' dd') || lo.includes('house door'))) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'KFV RH', 'Siegenia RH', 'Threshold #7', '#8', 'ADA'];
  }
  if (lo.includes('offset simulated') || lo.includes('offset french simulated')) {
    return ['72mm Thick Sash', '84mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('simulated dh') || lo.includes('simulated double hung')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('single hung') || lo.includes('double hung') || lo.includes('triple hung')) {
    return ['59mm Thick Sash', '72mm Thick Sash', '82mm Thick Sash', '90mm Thick Sash', 'Vent Locks'];
  }
  if (lo.includes('direct glaze')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Threshold to match'];
  }
  if (lo.includes('fixed with sash')) {
    return ['59mm Thick Sash', '72mm Thick Sash', '82mm Thick Sash', '90mm Thick Sash', 'Threshold to match'];
  }
  if (lo.includes('tilt-in') || lo.includes('tilt in')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('inswing')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('outswing') || lo.includes('awning')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('lift') || lo.includes('roll')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Standard RH', 'SS RH'];
  }
  return ['72mm Thick Sash', '90mm Thick Sash'];
}
