import {
  CloudSun,
  Lightbulb,
  Music2,
  Sparkles,
  Thermometer,
  Wind,
  PanelsTopLeft,
} from 'lucide-react';
export const kindIcons = {
  light: Lightbulb,
  climate: Thermometer,
  media: Music2,
  weather: CloudSun,
  scene: Sparkles,
  sensor: Wind,
  cover: PanelsTopLeft,
};
export const kindLabelKeys = {
  light: 'kind.light',
  climate: 'kind.climate',
  media: 'kind.media',
  weather: 'kind.weather',
  scene: 'kind.scene',
  sensor: 'kind.sensor',
  cover: 'kind.cover',
} as const;
