import { useEffect, useRef, useState } from 'react';
import type { Dashboard, Profile, Snapshot } from '../../shared/model';
import { conditionMatches } from '../../shared/experience';
import { useI18n } from '../i18n';
import { Modal } from '../ui/Modal';
import { CameraStream } from '../ui/CameraView';
export function useDisplayIdle(profile: Profile, home: () => void) {
  const [idle, setIdle] = useState(false);
  const homeRef = useRef(home);
  homeRef.current = home;
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>, homeTimer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(idleTimer);
      clearTimeout(homeTimer);
      if (profile.experience?.idleSeconds)
        idleTimer = setTimeout(() => setIdle(true), profile.experience.idleSeconds * 1000);
      if (profile.experience?.autoHomeSeconds)
        homeTimer = setTimeout(() => homeRef.current(), profile.experience.autoHomeSeconds * 1000);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(idleTimer);
      clearTimeout(homeTimer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [profile.id, profile.experience?.idleSeconds, profile.experience?.autoHomeSeconds]);
  return { idle, wake: () => setIdle(false) };
}
export function DisplayAlerts({
  document,
  profile,
  snapshot,
  onAlert,
}: {
  document: Dashboard;
  profile: Profile;
  snapshot: Snapshot;
  onAlert: () => void;
}) {
  const { t } = useI18n();
  type Rule = NonNullable<Dashboard['alerts']>[number];
  const seen = useRef(new Map<string, boolean>());
  const scope = useRef(profile.id);
  const [active, setActive] = useState<Rule>();
  useEffect(() => {
    if (scope.current !== profile.id) {
      scope.current = profile.id;
      seen.current.clear();
      setActive(undefined);
    }
    if (snapshot.status === 'reconnecting') {
      seen.current.clear();
      return;
    }
    const rules = document.alerts ?? [];
    const eligible = rules.filter((r) => !r.profileIds || r.profileIds.includes(profile.id));
    const incoming: Rule[] = [];
    for (const rule of eligible) {
      const next = conditionMatches(rule.condition, snapshot);
      if (seen.current.has(rule.id) && !seen.current.get(rule.id) && next) incoming.push(rule);
      seen.current.set(rule.id, next);
    }
    if (incoming.length) {
      const rank = { info: 0, warning: 1, critical: 2 };
      incoming.sort((a, b) => rank[b.priority] - rank[a.priority]);
      setActive((current) =>
        !current || rank[incoming[0].priority] >= rank[current.priority] ? incoming[0] : current,
      );
      onAlert();
    }
  }, [document.alerts, profile.id, snapshot]);
  useEffect(() => {
    const show = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const rule = document.alerts?.find(
        (rule) => rule.id === id && (!rule.profileIds || rule.profileIds.includes(profile.id)),
      );
      if (rule) {
        setActive({ ...rule });
        onAlert();
      }
    };
    window.addEventListener('hapanel:alert', show);
    return () => window.removeEventListener('hapanel:alert', show);
  }, [document.alerts, profile.id]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(undefined), active.timeout * 1000);
    return () => clearTimeout(timer);
  }, [active]);
  if (!active) return null;
  const camera = document.pages
    .flatMap((p) => p.tiles)
    .find((tile) => tile.id === active.cameraTileId && tile.kind === 'camera');
  return (
    <Modal
      title={active.title}
      className={'v2-alert priority-' + active.priority}
      onClose={() => setActive(undefined)}
      wide={Boolean(camera)}
    >
      <p>{active.message}</p>
      {camera && snapshot.cameraView && (
        <CameraStream tile={camera} snapshot={snapshot} base="api/display/camera/" />
      )}
      <button className="button primary" onClick={() => setActive(undefined)}>
        {t('v2.dismiss')}
      </button>
    </Modal>
  );
}
