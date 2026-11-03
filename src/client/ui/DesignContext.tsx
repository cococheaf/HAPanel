import { createContext } from 'react';
import type { CSSProperties } from 'react';
export const DesignContext = createContext<{ style: CSSProperties; scheme: string } | undefined>(
  undefined,
);
