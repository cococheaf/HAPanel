import { z } from 'zod';

// Only bounded values become CSS variables. Never execute CSS or URLs from design files.
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const designSchema = z
  .object({
    surface: z.enum(['glass', 'solid']),
    scheme: z.enum(['dark', 'light', 'auto']),
    wallpaper: z.enum(['landscape', 'aurora', 'gradient', 'plain']),
    background: color,
    tint: color,
    accent: color,
    opacity: z.number().int().min(4).max(95),
    blur: z.number().int().min(0).max(40),
    saturation: z.number().int().min(70).max(180),
    border: z.number().int().min(0).max(70),
    shadow: z.number().int().min(0).max(50),
    radius: z.number().int().min(6).max(40),
    textScale: z.number().min(0.8).max(1.25),
  })
  .strict();
export type Design = z.infer<typeof designSchema>;
export const savedDesignSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    name: z
      .string()
      .min(1)
      .max(64)
      .refine((v) => !!v.trim()),
    appearance: designSchema,
  })
  .strict();
export const designFileSchema = z
  .object({
    format: z.literal('hapanel-design'),
    version: z.literal(1),
    name: savedDesignSchema.shape.name,
    appearance: designSchema,
  })
  .strict();
export const designPresets = {
  glassDark: designSchema.parse({
    surface: 'glass',
    scheme: 'dark',
    wallpaper: 'landscape',
    background: '#111d37',
    tint: '#d2e4ff',
    accent: '#ffcf83',
    opacity: 14,
    blur: 26,
    saturation: 140,
    border: 24,
    shadow: 22,
    radius: 26,
    textScale: 1,
  }),
  glassLight: designSchema.parse({
    surface: 'glass',
    scheme: 'light',
    wallpaper: 'landscape',
    background: '#9aaed0',
    tint: '#ffffff',
    accent: '#bb7429',
    opacity: 48,
    blur: 26,
    saturation: 125,
    border: 60,
    shadow: 12,
    radius: 26,
    textScale: 1,
  }),
  aurora: designSchema.parse({
    surface: 'glass',
    scheme: 'dark',
    wallpaper: 'aurora',
    background: '#101e2d',
    tint: '#b8ffe4',
    accent: '#8df3cf',
    opacity: 12,
    blur: 24,
    saturation: 150,
    border: 22,
    shadow: 20,
    radius: 24,
    textScale: 1,
  }),
  minimal: designSchema.parse({
    surface: 'solid',
    scheme: 'light',
    wallpaper: 'plain',
    background: '#e9edf3',
    tint: '#ffffff',
    accent: '#4267b2',
    opacity: 95,
    blur: 0,
    saturation: 100,
    border: 50,
    shadow: 8,
    radius: 16,
    textScale: 1,
  }),
} satisfies Record<string, Design>;
export function parseDesignFile(raw: string) {
  if (raw.length > 16_384) throw new Error('Design file too large');
  return designFileSchema.parse(JSON.parse(raw));
}
export function exportDesign(name: string, appearance: Design) {
  return JSON.stringify(
    designFileSchema.parse({ format: 'hapanel-design', version: 1, name, appearance }),
    null,
    2,
  );
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
/** Shared by the canvas, paired player and portal dialogs. */
export function designVariables(design: Design): Record<string, string> {
  return {
    '--design-background': design.background,
    '--design-tint': rgb(design.tint),
    '--design-accent': design.accent,
    '--design-accent-rgb': rgb(design.accent),
    '--design-opacity': String(design.surface === 'solid' ? 1 : design.opacity / 100),
    '--design-blur': `${design.surface === 'solid' ? 0 : design.blur}px`,
    '--design-saturation': `${design.saturation}%`,
    '--design-border': String(design.border / 100),
    '--design-shadow': String(design.shadow / 100),
    '--tile-radius': `${design.radius}px`,
    '--design-text-scale': String(design.textScale),
  };
}
