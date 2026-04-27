import { BrandVariants, createDarkTheme, createLightTheme, Theme } from '@fluentui/react-components';

// Power Platform purple ramp.
const brand: BrandVariants = {
  10: '#050207',
  20: '#1B0E26',
  30: '#2B1640',
  40: '#3A1D5C',
  50: '#4A237A',
  60: '#5B2999',
  70: '#6E2FB8',
  80: '#8136D8',
  90: '#9446F1',
  100: '#A560F4',
  110: '#B477F6',
  120: '#C190F8',
  130: '#CDA9F9',
  140: '#D9C2FB',
  150: '#E5DBFC',
  160: '#F1EDFE',
};

export const lightTheme: Theme = {
  ...createLightTheme(brand),
};

export const darkTheme: Theme = {
  ...createDarkTheme(brand),
};

// Subtle overrides for surfaces in dark mode (deeper, less neutral)
darkTheme.colorNeutralBackground1 = '#15101D';
darkTheme.colorNeutralBackground2 = '#1B1426';
darkTheme.colorNeutralBackground3 = '#231A30';
darkTheme.colorNeutralBackground4 = '#2A1F3A';
