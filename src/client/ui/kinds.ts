import { CloudSun, Lightbulb, Music2, Sparkles, Thermometer, Wind } from 'lucide-react';
export const kindIcons = {
  light: Lightbulb,
  climate: Thermometer,
  media: Music2,
  weather: CloudSun,
  scene: Sparkles,
  sensor: Wind,
};
export const kindLabelKeys = {
  light: 'kind.light',
  climate: 'kind.climate',
  media: 'kind.media',
  weather: 'kind.weather',
  scene: 'kind.scene',
  sensor: 'kind.sensor',
} as const;
