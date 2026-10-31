import { useStreamBudget } from './stream-budget';
import { useEffect, useRef, useState } from 'react';
import { Camera, Play, RefreshCw, VideoOff, LoaderCircle } from 'lucide-react';
import type { Snapshot, Tile } from '../../shared/model';
import { startCameraPlayback, jumpToLive, type PlaybackTransport } from './camera-playback';
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
  const entity = snapshot.entities[tile.camera?.overviewEntityId ?? tile.entityId];
  const online =
    entity &&
    !['unknown', 'unavailable', 'off'].includes(entity.state) &&
    snapshot.status !== 'reconnecting';
  useEffect(() => {
    if (!visible || !allowed || !online || sample || (tile.camera?.overview === 'live' && onOpen))
      return;
    const timer = setInterval(
      () => {
        setFailed(false);
        setTick(Date.now());
      },
      (tile.camera?.refreshSeconds ?? 30) * 1000,
    );
    return () => clearInterval(timer);
  }, [
    visible,
    allowed,
    online,
    sample,
    tile.camera?.refreshSeconds,
    tile.camera?.overview,
    onOpen,
  ]);
  if (tile.camera?.overview === 'live' && onOpen)
    return (
      <div className="camera-frame camera-overview-live">
        <CameraStream tile={tile} snapshot={snapshot} base={base} inline />
        <button
          type="button"
          className="camera-open-overlay"
          aria-label={t('camera.open', { title: tile.title })}
          onClick={onOpen}
        />
      </div>
    );
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
          src={
            base + tile.id + (tile.camera?.overviewEntityId ? '/overview' : '') + '/still?t=' + tick
          }
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
  inline = false,
}: {
  tile: Tile;
  snapshot: Snapshot;
  base: string;
  inline?: boolean;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!inline);
  const [transport, setTransport] = useState<PlaybackTransport>();
  const [fallback, setFallback] = useState(false),
    [lag, setLag] = useState(0);
  const startedAt = useRef(0);
  const [startup, setStartup] = useState<number>();
  const lastStats = useRef(0),
    initialSync = useRef(false);
  const [obscured, setObscured] = useState(false);
  useEffect(() => {
    if (!inline) return;
    const update = () => {
      const dialogs = window.document.querySelectorAll('dialog[open]');
      const top = dialogs[dialogs.length - 1];
      setObscured(Boolean(top && !top.contains(hostRef.current)));
    };
    window.addEventListener('hapanel:modal', update);
    update();
    return () => window.removeEventListener('hapanel:modal', update);
  }, [inline]);
  useEffect(() => {
    if (!inline) {
      setInView(true);
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '20px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [inline, tile.id]);
  const [retry, setRetry] = useState(0),
    [phase, setPhase] = useState<'loading' | 'playing' | 'paused' | 'error'>('loading');
  const visible = usePageVisible();
  const sample = snapshot.status === 'demo';
  const allowed = snapshot.cameraView ?? sample;
  const entity =
    snapshot.entities[
      inline && tile.camera?.overviewEntityId ? tile.camera.overviewEntityId : tile.entityId
    ];
  const sourceBase = base + tile.id + (inline && tile.camera?.overviewEntityId ? '/overview' : '');
  const streamable = Boolean(Number(entity?.attributes.supported_features) & 2);
  const online =
    entity &&
    !['unknown', 'unavailable', 'off'].includes(entity.state) &&
    snapshot.status !== 'reconnecting';
  const granted = useStreamBudget(
    visible && inView && !obscured && !sample && allowed && Boolean(online) && streamable,
    inline,
  );
  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      !visible ||
      !inView ||
      obscured ||
      sample ||
      !allowed ||
      !online ||
      !streamable ||
      !granted
    )
      return;
    startedAt.current = performance.now();
    setStartup(undefined);
    setPhase('loading');
    setFallback(false);
    setLag(0);
    initialSync.current = false;
    return startCameraPlayback(video, sourceBase, tile.camera?.transport ?? 'auto', {
      transport: setTransport,
      fallback: () => {
        setFallback(true);
        setPhase('loading');
      },
      failed: () => setPhase('error'),
      paused: () => setPhase('paused'),
    });
  }, [
    tile.id,
    base,
    sourceBase,
    sample,
    allowed,
    online,
    visible,
    inView,
    retry,
    streamable,
    tile.camera?.transport,
    obscured,
    granted,
  ]);
  const body = () => {
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
    if (inline && streamable && !granted && allowed && online)
      return (
        <div className="camera-placeholder">
          <Camera size={30} />
          <p>{t('v2.cameraBudget')}</p>
        </div>
      );
    if (!streamable)
      return (
        <CameraStillLive tile={tile} base={sourceBase} active={visible && inView && !obscured} />
      );
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
            {phase === 'playing' && transport && (
              <small>{transport === 'webrtc' ? 'WebRTC' : 'HLS'}</small>
            )}
          </span>
          <button
            type="button"
            className="alarm-open"
            onClick={() => setRetry((value) => value + 1)}
          >
            <RefreshCw size={15} />
            {t('common.retry')}
          </button>
        </div>
        <div className="camera-video-wrap">
          <video
            ref={videoRef}
            controls={!inline}
            disableRemotePlayback
            style={{ objectFit: inline ? (tile.camera?.fit ?? 'cover') : 'contain' }}
            autoPlay
            muted
            playsInline
            preload="none"
            poster={sourceBase + '/still'}
            onLoadedData={() => {
              if (startedAt.current) setStartup((performance.now() - startedAt.current) / 1000);
            }}
            onPlaying={() => {
              setPhase('playing');
              if (transport === 'hls' && !initialSync.current && videoRef.current) {
                initialSync.current = true;
                jumpToLive(videoRef.current);
              }
            }}
            onLoadedMetadata={() => {
              if (transport === 'hls' && videoRef.current?.seekable.length) {
                initialSync.current = true;
                jumpToLive(videoRef.current);
              }
            }}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video || transport !== 'hls' || Date.now() - lastStats.current < 1000) return;
              lastStats.current = Date.now();
              if (video.seekable.length) {
                const distance = video.seekable.end(video.seekable.length - 1) - video.currentTime;
                setLag(Math.max(0, Math.round(distance)));
                if (distance > 8 && !video.paused) jumpToLive(video);
              }
            }}
            onPause={() => setPhase((current) => (current === 'error' ? 'error' : 'paused'))}
            onError={() => setPhase('error')}
          />
          {phase === 'loading' && (
            <div className="camera-video-overlay">
              <LoaderCircle className="spin" size={35} />
              <span>{t('camera.loading')}</span>
            </div>
          )}
          {phase === 'paused' && (
            <div className="camera-video-overlay">
              <button
                type="button"
                className="alarm-open"
                onClick={() => void videoRef.current?.play().catch(() => setPhase('error'))}
              >
                <Play size={18} />
                {t('camera.start')}
              </button>
            </div>
          )}
          {phase === 'error' && (
            <div className="camera-video-overlay">
              <VideoOff size={35} />
              <span>{t('camera.failed')}</span>
            </div>
          )}
        </div>
        {!inline && (
          <>
            {startup !== undefined && (
              <p className="insight-muted">
                {t('v2.startupTime')}: {startup.toFixed(1)} s
              </p>
            )}
            <p className="insight-muted">{t('v2.latencyHint')}</p>
            <p className="insight-muted">
              {transport === 'webrtc'
                ? t('camera.directConnection')
                : t(fallback ? 'camera.fallbackHls' : 'camera.onDemand')}
              {transport === 'hls' && lag > 2
                ? ' · ' + t('camera.bufferLag', { seconds: lag })
                : ''}
            </p>
            {transport === 'hls' && (
              <button
                className="alarm-open"
                onClick={() => videoRef.current && jumpToLive(videoRef.current)}
              >
                {t('camera.jumpLive')}
              </button>
            )}
          </>
        )}
      </div>
    );
  };
  return (
    <div ref={hostRef} className={inline ? 'camera-inline-host' : 'camera-stream-host'}>
      {body()}
    </div>
  );
}

function CameraStillLive({
  tile,
  base,
  active = true,
}: {
  tile: Tile;
  base: string;
  active?: boolean;
}) {
  const { t } = useI18n();
  const tabVisible = usePageVisible();
  const visible = tabVisible && active;
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
            src={base + '/still?live=1&t=' + tick}
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
