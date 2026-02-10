import type { CSSProperties } from 'react';

export interface GameItem {
  id?: string;
  label: string;
  href: string;
  // Image data prepared by Astro for React
  imageSrc?: {
    src: string;
    srcSet?: {
      attribute: string;
    };
    width?: number;
    height?: number;
  } | null;
  // Visuals
  width?: string | number;
  height?: string | number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  aspectRatio?: string;
  background?: string;
  style?: CSSProperties;
}
