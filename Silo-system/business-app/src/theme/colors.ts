/**
 * SILO DESIGN SYSTEM - COLORS
 * Consistent color palette across all Silo frontends
 * Based on Tailwind Zinc Palette
 */

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  border: string;
  input: string;
  ring: string;
  // Aliases for convenience
  text: string;
  textMuted: string;
  surface: string;
}

export const lightColors: ThemeColors = {
  background: '#fafafa', // Zinc 50
  foreground: '#18181b', // Zinc 900
  card: '#ffffff',
  cardForeground: '#18181b',
  popover: '#ffffff',
  popoverForeground: '#18181b',
  primary: '#18181b', // Zinc 900
  primaryForeground: '#fafafa',
  secondary: '#f4f4f5', // Zinc 100
  secondaryForeground: '#18181b',
  muted: '#f4f4f5', // Zinc 100
  mutedForeground: '#71717a', // Zinc 500
  accent: '#f4f4f5',
  accentForeground: '#18181b',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  success: '#22c55e',
  successForeground: '#ffffff',
  border: '#e4e4e7', // Zinc 200
  input: '#e4e4e7',
  ring: '#18181b',
  // Aliases
  text: '#18181b',
  textMuted: '#71717a',
  surface: '#ffffff',
};

export const darkColors: ThemeColors = {
  background: '#09090b', // Zinc 950
  foreground: '#fafafa', // Zinc 50
  card: '#18181b', // Zinc 900
  cardForeground: '#fafafa',
  popover: '#18181b',
  popoverForeground: '#fafafa',
  primary: '#fafafa', // Zinc 50
  primaryForeground: '#18181b',
  secondary: '#27272a', // Zinc 800
  secondaryForeground: '#fafafa',
  muted: '#27272a', // Zinc 800
  mutedForeground: '#a1a1aa', // Zinc 400
  accent: '#27272a',
  accentForeground: '#fafafa',
  destructive: '#7f1d1d',
  destructiveForeground: '#fafafa',
  success: '#14532d',
  successForeground: '#fafafa',
  border: '#27272a', // Zinc 800
  input: '#27272a',
  ring: '#d4d4d8', // Zinc 300
  // Aliases
  text: '#fafafa',
  textMuted: '#a1a1aa',
  surface: '#18181b',
};

// Default export for backward compatibility (light mode)
export const colors = lightColors;

// Get colors based on scheme
export function getColors(scheme: ColorScheme = 'light'): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export default colors;
