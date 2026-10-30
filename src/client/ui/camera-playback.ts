import type { CameraCapabilities, CameraCandidate, CameraSignalEvent } from '../../shared/camera';
export type PlaybackTransport = 'webrtc' | 'hls';
/** Read-only media: no microphone/camera permission and no external STUN/TURN service. */
export function startCameraPlayback(
  video: HTMLVideoElement,
  base: string,
  preference: 'auto' | 'webrtc' | 'hls',
  events: {
    transport: (value: PlaybackTransport) => void;
    fallback: () => void;
    failed: () => void;
    paused: () => void;
  },
) {
  let disposed = false,
    rtcActive = false,
    hlsStarted = false;
  let peer: RTCPeerConnection | undefined,
    socket: WebSocket | undefined,
    player: import('hls.js').default | undefined;
  let rtcTimer: ReturnType<typeof setTimeout> | undefined,
    stallTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  const played = () => {
    if (rtcActive && video.videoWidth > 0) clearTimeout(rtcTimer);
  };
  video.addEventListener('playing', played);
  video.addEventListener('resize', played);
  const stopRtc = () => {
    rtcActive = false;
    clearTimeout(rtcTimer);
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
      peer = undefined;
    }
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = undefined;
    }
    video.srcObject = null;
  };
  const play = () =>
    void video.play().catch(() => {
      if (!disposed) events.paused();
    });
  const startHls = () => {
    if (disposed || hlsStarted) return;
    hlsStarted = true;
    stopRtc();
    events.transport('hls');
    const source = new URL(base + '/stream.m3u8', document.baseURI).href;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      play();
    } else
      void import('hls.js')
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            events.failed();
            return;
          }
          player = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            liveSyncDurationCount: 1,
            liveMaxLatencyDurationCount: 3,
            maxLiveSyncPlaybackRate: 1.1,
            maxBufferLength: 6,
            maxMaxBufferLength: 12,
            backBufferLength: 0,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
          });
          player.on(Hls.Events.ERROR, (_, data) => {
            if (!disposed && data.fatal) {
              events.failed();
              player?.destroy();
            }
          });
          player.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!disposed) play();
          });
          player.loadSource(source);
          player.attachMedia(video);
        })
        .catch(() => {
          if (!disposed) events.failed();
        });
  };
  const fallback = () => {
    if (disposed || !rtcActive) return;
    stopRtc();
    if (preference === 'webrtc') {
      events.failed();
      return;
    }
    events.fallback();
    startHls();
  };
  const startRtc = (capabilities: CameraCapabilities) => {
    if (disposed) return;
    rtcActive = true;
    events.transport('webrtc');
    let offered = false;
    const local: CameraCandidate[] = [],
      remote: CameraCandidate[] = [];
    const url = new URL(base + '/webrtc', document.baseURI);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url);
    rtcTimer = setTimeout(fallback, 8000);
    const send = (candidate: CameraCandidate) => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'candidate', candidate }));
    };
    socket.onopen = () => {
      void (async () => {
        if (!rtcActive || disposed) return;
        // Host candidates use the existing local HA media route. No third-party ICE service.
        peer = new RTCPeerConnection({ iceServers: [] });
        if (capabilities.dataChannel) peer.createDataChannel(capabilities.dataChannel);
        const stream = new MediaStream();
        video.srcObject = stream;
        peer.addTransceiver('video', { direction: 'recvonly' });
        peer.addTransceiver('audio', { direction: 'recvonly' });
        peer.ontrack = (event) => {
          if (!rtcActive) return;
          if (!stream.getTracks().some((track) => track.id === event.track.id))
            stream.addTrack(event.track);
          play();
        };
        peer.onicecandidate = (event) => {
          if (!event.candidate || !rtcActive) return;
          const candidate = { ...event.candidate.toJSON(), candidate: event.candidate.candidate };
          if (offered) send(candidate);
          else if (local.length < 64) local.push(candidate);
        };
        peer.onconnectionstatechange = () => {
          if (!rtcActive) return;
          if (peer?.connectionState === 'connected') {
            clearTimeout(stallTimer);
          } else if (peer?.connectionState === 'failed') fallback();
          else if (peer?.connectionState === 'disconnected') {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(fallback, 2500);
          }
        };
        const offer = await peer.createOffer();
        if (!rtcActive || disposed) return;
        await peer.setLocalDescription(offer);
        if (!rtcActive || disposed) return;
        socket?.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
        offered = true;
        local.splice(0).forEach(send);
      })().catch(fallback);
    };
    socket.onmessage = (event) => {
      void (async () => {
        if (!rtcActive || disposed) return;
        const message = JSON.parse(event.data) as CameraSignalEvent;
        if (message.type === 'error') {
          fallback();
          return;
        }
        if (message.type === 'answer') {
          await peer?.setRemoteDescription({ type: 'answer', sdp: message.sdp });
          for (const candidate of remote.splice(0))
            await peer?.addIceCandidate(
              candidate.sdpMid || candidate.sdpMLineIndex != null
                ? candidate
                : { ...candidate, sdpMid: '0' },
            );
        } else if (message.type === 'candidate') {
          if (peer?.remoteDescription)
            await peer.addIceCandidate(
              message.candidate.sdpMid || message.candidate.sdpMLineIndex != null
                ? message.candidate
                : { ...message.candidate, sdpMid: '0' },
            );
          else if (remote.length < 64) remote.push(message.candidate);
        }
      })().catch(fallback);
    };
    socket.onclose = fallback;
    socket.onerror = fallback;
  };
  void (async () => {
    if (preference === 'hls') {
      startHls();
      return;
    }
    if (typeof RTCPeerConnection === 'undefined') {
      if (preference === 'webrtc') events.failed();
      else startHls();
      return;
    }
    const timeout = setTimeout(() => abort.abort(), 5000);
    try {
      const response = await fetch(new URL(base + '/capabilities', document.baseURI), {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: abort.signal,
      });
      if (!response.ok) throw new Error();
      const capabilities = (await response.json()) as CameraCapabilities;
      if (disposed) return;
      if (capabilities.webrtc) startRtc(capabilities);
      else if (preference === 'webrtc') events.failed();
      else startHls();
    } catch {
      if (!disposed) {
        if (preference === 'webrtc') events.failed();
        else startHls();
      }
    } finally {
      clearTimeout(timeout);
    }
  })();
  return () => {
    disposed = true;
    video.removeEventListener('playing', played);
    video.removeEventListener('resize', played);
    abort.abort();
    clearTimeout(stallTimer);
    stopRtc();
    player?.destroy();
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load();
  };
}
export function jumpToLive(video: HTMLVideoElement) {
  if (!video.seekable.length) return;
  const end = video.seekable.end(video.seekable.length - 1);
  const start = video.seekable.start(video.seekable.length - 1);
  if (end - start > 0.5) video.currentTime = Math.max(start, end - 0.8);
}
