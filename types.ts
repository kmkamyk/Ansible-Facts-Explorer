
export type Density = 'compact' | 'comfortable' | 'spacious';

export interface FactRow {
  id: string;
  host: string;
  factPath: string;
  value: string | number | boolean | null | object;
  modified?: string;
}

export type HostFactData = Record<string, any>;

export type AllHostFacts = Record<string, HostFactData>;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

// Define sorting types
export type SortableKey = string;
export type SortDirection = 'ascending' | 'descending';
export interface SortConfig {
  key: SortableKey;
  direction: SortDirection;
}
