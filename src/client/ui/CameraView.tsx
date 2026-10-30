import { useEffect, useRef, useState } from 'react';
import { Camera, Play, RefreshCw, VideoOff, LoaderCircle } from 'lucide-react';
import type { Snapshot, Tile } from '../../shared/model';
import { useI18n } from '../i18n';

function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  return visible;
}
export function CameraThumbnail({
  tile,
  snapshot,
  base,
  onOpen,
}: {
  tile: Tile;
  snapshot: Snapshot;
  base: string;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const [tick, setTick] = useState(Date.now()),
    [failed, setFailed] = useState(false);
  const visible = usePageVisible();
  const sample = snapshot.status === 'demo';
  const allowed = snapshot.cameraView ?? sample;
  const entity = snapshot.entities[tile.entityId];
  const online =
    entity &&
    !['unknown', 'unavailable', 'off'].includes(entity.state) &&
    snapshot.status !== 'reconnecting';
  useEffect(() => {
    if (!visible || !allowed || !online || sample) return;
    const timer = setInterval(
      () => {
        setFailed(false);
        setTick(Date.now());
      },
      (tile.camera?.refreshSeconds ?? 30) * 1000,
    );
    return () => clearInterval(timer);
  }, [visible, allowed, online, sample, tile.camera?.refreshSeconds]);
  return (
    <button
      className="camera-frame"
      type="button"
      aria-label={t('camera.open', { title: tile.title })}
      onClick={onOpen}
      disabled={!onOpen}
    >
      {allowed && online && !sample && visible && (
        <img
          src={base + tile.id + '/still?t=' + tick}
          alt={t('camera.image', { title: tile.title })}
          style={{ objectFit: tile.camera?.fit ?? 'cover', opacity: failed ? 0 : 1 }}
          onError={() => setFailed(true)}
          onLoad={(event) =>
            setFailed(event.currentTarget.naturalWidth < 2 || event.currentTarget.naturalHeight < 2)
          }
        />
      )}
      {sample ? (
        <span className="camera-placeholder">
          <Camera size={37} />
          <span>{t('camera.sample')}</span>
        </span>
      ) : !allowed || !online || failed ? (
        <span className="camera-placeholder">
          <VideoOff size={30} />
          <span>{t(!allowed ? 'error.cameraAdminRequired' : 'error.cameraUnavailable')}</span>
        </span>
      ) : (
        <span className="camera-play">
          <Play size={25} />
        </span>
      )}
      <span className="camera-caption">
        {t(sample ? 'camera.previewLabel' : 'camera.openStream')}
      </span>
    </button>
  );
}

export function CameraStream({
  tile,
  snapshot,
  base,
}: {
  tile: Tile;
  snapshot: Snapshot;
  base: string;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [retry, setRetry] = useState(0),
    [phase, setPhase] = useState<'loading' | 'playing' | 'paused' | 'error'>('loading');
  const visible = usePageVisible();
  const sample = snapshot.status === 'demo';
  const allowed = snapshot.cameraView ?? sample;
  const entity = snapshot.entities[tile.entityId];
  const streamable = Boolean(Number(entity?.attributes.supported_features) & 2);
  const online =
    entity &&
    !['unknown', 'unavailable', 'off'].includes(entity.state) &&
    snapshot.status !== 'reconnecting';
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible || sample || !allowed || !online || !streamable) return;
    let disposed = false;
    let player: import('hls.js').default | undefined;
    setPhase('loading');
    const source = new URL(base + tile.id + '/stream.m3u8?retry=' + retry, document.baseURI).href;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      void video.play().catch(() => {});
    } else
      void import('hls.js')
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setPhase('error');
            return;
          }
          player = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 15,
            backBufferLength: 15,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
          });
          player.on(Hls.Events.ERROR, (_, data) => {
            if (!disposed && data.fatal) {
              setPhase('error');
              player?.destroy();
            }
          });
          player.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!disposed) void video.play().catch(() => {});
          });
          player.loadSource(source);
          player.attachMedia(video);
        })
        .catch(() => {
          if (!disposed) setPhase('error');
        });
    return () => {
      disposed = true;
      player?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [tile.id, base, sample, allowed, online, visible, retry, streamable]);
  if (sample)
    return (
      <div className="camera-sample-view">
        <Camera size={55} />
        <h3>{t('camera.sample')}</h3>
        <p>{t('camera.sampleHint')}</p>
      </div>
    );
  if (!allowed || !online)
    return (
      <p className="insight-muted">
        {t(!allowed ? 'error.cameraAdminRequired' : 'error.cameraUnavailable')}
      </p>
    );
  if (!streamable) return <CameraStillLive tile={tile} base={base} />;
  return (
    <div className="camera-live">
      <div className="camera-live-header">
        <span className={'camera-live-state is-' + phase}>
          <i />
          {t(
            phase === 'playing'
              ? 'camera.live'
              : phase === 'paused'
                ? 'camera.paused'
                : phase === 'error'
                  ? 'camera.failed'
                  : 'camera.loading',
          )}
        </span>
        <button type="button" className="alarm-open" onClick={() => setRetry((value) => value + 1)}>
          <RefreshCw size={15} />
          {t('common.retry')}
        </button>
      </div>
      <div className="camera-video-wrap">
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          preload="none"
          poster={base + tile.id + '/still'}
          onPlaying={() => setPhase('playing')}
          onPause={() => setPhase((current) => (current === 'error' ? 'error' : 'paused'))}
          onError={() => setPhase('error')}
        />
        {phase === 'loading' && (
          <div className="camera-video-overlay">
            <LoaderCircle className="spin" size={35} />
            <span>{t('camera.loading')}</span>
          </div>
        )}
        {phase === 'error' && (
          <div className="camera-video-overlay">
            <VideoOff size={35} />
            <span>{t('camera.failed')}</span>
          </div>
        )}
      </div>
      <p className="insight-muted">{t('camera.onDemand')}</p>
    </div>
  );
}

function CameraStillLive({ tile, base }: { tile: Tile; base: string }) {
  const { t } = useI18n();
  const visible = usePageVisible();
  const [tick, setTick] = useState(Date.now()),
    [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schedule = () => {
    clearTimeout(timer.current);
    if (!document.hidden) timer.current = setTimeout(() => setTick(Date.now()), 2000);
  };
  useEffect(() => {
    if (visible) setTick(Date.now());
    return () => clearTimeout(timer.current);
  }, [visible]);
  return (
    <div className="camera-live">
      <div className="camera-live-header">
        <span>{t('camera.stillSequence')}</span>
      </div>
      <div className="camera-video-wrap">
        {visible && (
          <img
            src={base + tile.id + '/still?live=1&t=' + tick}
            alt={t('camera.image', { title: tile.title })}
            style={{ opacity: failed ? 0 : 1 }}
            onError={() => {
              setFailed(true);
              schedule();
            }}
            onLoad={(event) => {
              setFailed(
                event.currentTarget.naturalWidth < 2 || event.currentTarget.naturalHeight < 2,
              );
              schedule();
            }}
          />
        )}
        {failed && (
          <div className="camera-video-overlay" role="status">
            <VideoOff size={35} />
            <span>{t('error.cameraUnavailable')}</span>
          </div>
        )}
      </div>
      <p className="insight-muted">{t(failed ? 'error.cameraUnavailable' : 'camera.stillOnly')}</p>
    </div>
  );
}
