// Single source of the Kamito visual theme. Defaults pending the official brand guideline.
export const tokens = {
  color: {
    primary: '#EC1E24',
    primaryStrong: '#A31115',
    ink: '#0A0A0A',
    data: '#0F285D',
    dataDeep: '#0F2452',
    // Only on navy/black backgrounds (contrast).
    live: '#E3F42A',
    border: '#E5E5E5',
    surface: '#FFFFFF',
    surfaceAlt: '#FAFAFA',
    surfaceMuted: '#F5F5F5',
  },
  font: {
    family: "'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    weights: [300, 400, 500, 600, 700, 800],
  },
  radius: { button: 4, card: 8, hero: 20, pill: 999 },
  space: { sectionDesktop: 64, sectionMobile: 40 },
  layout: { containerMax: 1520, gutterDesktop: 40, gutterMobile: 16 },
} as const;

export type Tokens = typeof tokens;
