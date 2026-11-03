import type { Design } from '../../shared/design';
import { useImageSource } from './ImageContext';
export function WallpaperPhoto({
  image,
  scheme,
}: {
  image: NonNullable<Design['image']>;
  scheme: string;
}) {
  const source = useImageSource(image.assetId);
  if (!source.url || source.failed) return null;
  return (
    <div className="wallpaper-photo" aria-hidden="true">
      <img
        src={source.url}
        alt=""
        decoding="async"
        onError={source.onError}
        style={{
          objectFit: image.fit,
          objectPosition: `${image.x}% ${image.y}%`,
          transform: `scale(${image.zoom + (image.blur ? 0.06 : 0)})`,
          transformOrigin: `${image.x}% ${image.y}%`,
          filter: `blur(${image.blur}px) brightness(${image.brightness / 100})`,
        }}
      />
      <div
        style={{
          background: scheme === 'light' ? '#ffffff' : '#000000',
          opacity: image.overlay / 100,
        }}
      />
    </div>
  );
}
