import { createContext, useContext, useEffect, useState } from 'react';
import { ApiImageLibrary, type ImageLibrary } from '../images';
export const ImageLibraryContext = createContext<ImageLibrary>(
  new ApiImageLibrary('api/display/assets/'),
);
export function useImageSource(id: string | undefined, thumbnail = false) {
  const library = useContext(ImageLibraryContext),
    [state, setState] = useState<{ id?: string; url?: string; failed?: boolean }>({});
  useEffect(() => {
    let active = true,
      release: (() => void) | undefined;
    setState({ id });
    if (id)
      library
        .source(id, thumbnail)
        .then((result) => {
          if (active) {
            release = result.release;
            setState({ id, url: result.url });
          } else result.release();
        })
        .catch(() => {
          if (active) setState({ id, failed: true });
        });
    return () => {
      active = false;
      release?.();
    };
  }, [id, thumbnail, library]);
  return { ...(state.id === id ? state : {}), onError: () => setState({ id, failed: true }) };
}
