import { BrandVariants, createDarkTheme, createLightTheme, Theme } from '@fluentui/react-components';

// Foundations brand ramp — derived from the landing page primary blue (#0078d4 / "Fluent web blue").
// Matches docs/index.html `--brand-primary` so wizard-ux looks like a continuation of the marketing
// site, not a separate product.
const brand: BrandVariants = {
  10: '#001120',
  20: '#002A4D',
  30: '#003E70',
  40: '#005091',
  50: '#0061AC',
  60: '#0078D4', // brand-primary
  70: '#1B8AE0',
  80: '#3398E8',
  90: '#4FA7EE',
  100: '#6BB6F2',
  110: '#85C3F5',
  120: '#9FCFF7',
  130: '#B7DBF9',
  140: '#CCE5FB',
  150: '#DEEDFC',
  160: '#EFF6FE',
};

// Accent palette — purple and teal complete the tri-color hero gradient used on the landing page.
export const accent = {
  purple: '#5C2D91',
  purpleSoft: '#7A4BB0',
  teal: '#008272',
  green: '#107C10',
  orange: '#D83B01',
  gold: '#FFB900',
} as const;

// Signature gradients used by hero surfaces, brand badges, and accent strokes.
export const gradients = {
  hero: 'linear-gradient(135deg, #0078D4 0%, #5C2D91 50%, #008272 100%)',
  heroDark: 'linear-gradient(135deg, #003E70 0%, #3B1967 50%, #005C52 100%)',
  accent: 'linear-gradient(90deg, #0078D4, #5C2D91)',
  accentSoft: 'linear-gradient(135deg, rgba(0,120,212,0.12) 0%, rgba(92,45,145,0.10) 100%)',
} as const;

export const lightTheme: Theme = {
  ...createLightTheme(brand),
};

export const darkTheme: Theme = {
  ...createDarkTheme(brand),
};

// Cooler, navy-leaning dark surfaces (matches landing page's gradient-hero-dark feel).
darkTheme.colorNeutralBackground1 = '#0E1620';
darkTheme.colorNeutralBackground2 = '#131F2D';
darkTheme.colorNeutralBackground3 = '#1A2838';
darkTheme.colorNeutralBackground4 = '#223145';
