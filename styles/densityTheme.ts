import { Density } from '../types';

type DensityTheme = {
  [key in Density]: {
    containerPadding: string;
    headerGap: string;
    headerMarginBottom: string;
    controlsGap: string;
    controlsMarginBottom: string;
    button: string;
    input: string;
    tableRowHeight: number;
    tableCellPadding: string;
  };
};

export const DENSITY_THEME: DensityTheme = {
  compact: {
    containerPadding: 'p-2',
    headerGap: 'gap-2',
    headerMarginBottom: 'mb-3',
    controlsGap: 'gap-2',
    controlsMarginBottom: 'mb-2',
    button: 'px-3 py-1 text-xs',
    input: 'py-1.5',
    tableRowHeight: 32,
    tableCellPadding: 'py-1',
  },
  comfortable: {
    containerPadding: 'p-4',
    headerGap: 'gap-3',
    headerMarginBottom: 'mb-4',
    controlsGap: 'gap-3',
    controlsMarginBottom: 'mb-3',
    button: 'px-3 py-1.5 text-sm',
    input: 'py-2',
    tableRowHeight: 40,
    tableCellPadding: 'py-2',
  },
  spacious: {
    containerPadding: 'p-4 sm:p-6 lg:p-8',
    headerGap: 'gap-4',
    headerMarginBottom: 'mb-6',
    controlsGap: 'gap-4',
    controlsMarginBottom: 'mb-4',
    button: 'px-4 py-2 text-sm',
    input: 'py-2',
    tableRowHeight: 56,
    tableCellPadding: 'py-4',
  },
};
