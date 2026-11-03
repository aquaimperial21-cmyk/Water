'use client';

// Firmware updates (OTA) for the purifier chips (ESP32).
//
//   • Upload a signed release: the .bin and its .release.json, both made by
//     `node tools/release.mjs sign` in Android_SmartRO_Firmware. The browser
//     reads the manifest and checks the pair before anything is sent.
//   • Roll it out: Off → Test (listed serials) → All purifiers. Purifiers
//     install at night (02:00–05:00 IST) unless "Install now" is on.
//   • Watch each purifier's update and retry the ones that failed.
//
// Refreshes every 30 s while the tab is visible.
// Release guide: Android_SmartRO_Firmware/smartro_valve/OTA.md

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Shell } from '../../components/Shell';
import { Button, Card, Drawer, FileDrop, FormField, Input, Pill, Stat, Textarea } from '../../components/UI';
import { confirmDialog, toast } from '../../components/Feedback';
import { api, apiErrorMessage, formatDateTime } from '../../lib/api';

/* ============================================================
   Types (server contract: /firmware/admin/*)
   ============================================================ */

type Rollout = 'OFF' | 'TEST' | 'ALL';

interface ReleaseCounts {
  onThisVersion: number;
  offered: number;
  downloading: number;
  installed: number;
  failed: number;
}

interface Release {
  id: string;
  version: string;
  sizeBytes: number;
  sha256: string;
  notes?: string | null;
  rollout: Rollout;
  testSerials: string[];
  installNow: boolean;
  createdAt: string;
  counts?: Partial<ReleaseCounts> | null;
}

interface OtaDevice {
  serial: string;
  firmwareVersion?: string | null;
  otaReleaseId?: string | null;
  otaReleaseVersion?: string | null;
  otaStatus?: string | null;
  otaError?: string | null;
  otaAttempts?: number | null;
  otaUpdatedAt?: string | null;
  lastHeartbeatAt?: string | null;
  isOnline?: boolean;
}

interface Manifest {
  version: string;
  size: number;
  sha256: string;
  signature: string;
  createdAt?: string;
  keyFingerprint?: string;
}

type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'ink';

/* ============================================================
   Constants + helpers
   ============================================================ */

const REFRESH_MS = 30_000;
/** First firmware that can update over Wi-Fi. Older chips need one USB flash. */
const OTA_MIN_VERSION = '1.1.0';
/** App slot of the min_spiffs partition table. A bigger image can't be installed. */
const APP_SLOT_BYTES = 0x1e0000;
const MAX_ATTEMPTS = 3;

const OTA_STATUS: Record<string, { label: string; tone: PillTone }> = {
  OFFERED: { label: 'Offered', tone: 'accent' },
  DOWNLOADING: { label: 'Downloading', tone: 'accent' },
  INSTALLED: { label: 'Installed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  ROLLED_BACK: { label: 'Rolled back', tone: 'warning' },
};

function statusInfo(s?: string | null): { label: string; tone: PillTone } | null {
  if (!s) return null;
  const key = s.toUpperCase();
  if (OTA_STATUS[key]) return OTA_STATUS[key];
  const words = key.replace(/_/g, ' ').toLowerCase();
  return { label: words.charAt(0).toUpperCase() + words.slice(1), tone: 'neutral' };
}

const needsRetry = (s?: string | null) => s === 'FAILED' || s === 'ROLLED_BACK';

function parseVersion(v?: string | null): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmpVersion(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/** True when the chip's firmware is new enough to update over Wi-Fi. */
function canUpdateRemotely(v?: string | null): boolean {
  const p = parseVersion(v);
  const min = parseVersion(OTA_MIN_VERSION);
  return Boolean(p && min && cmpVersion(p, min) >= 0);
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Split "SR-TEST-0001, sr-test-0002\nSR-AP-000101" into clean, unique serials. */
function parseSerials(text: string): string[] {
  const out: string[] = [];
  for (const s of text.split(/[\s,;]+/)) {
    const v = s.trim().toUpperCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Friendlier wording for the "server isn't deployed yet" and "can't connect" cases. */
function loadError(e: unknown): string {
  const ax = e as { response?: { status?: number } };
  if (ax?.response?.status === 404) {
    return "The server doesn't have firmware updates yet (404). Deploy the latest backend, then refresh.";
  }
  if (!ax?.response) return `Can't reach the server: ${apiErrorMessage(e)}`;
  return apiErrorMessage(e);
}

function validateManifest(j: unknown): Manifest | string {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return 'The manifest is not a JSON object.';
  const m = j as Record<string, unknown>;
  if (typeof m.version !== 'string' || !m.version.trim()) return 'The manifest has no "version".';
  if (typeof m.size !== 'number' || !Number.isInteger(m.size) || m.size <= 0) return 'The manifest has no valid "size".';
  if (typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256)) {
    return 'The manifest "sha256" must be 64 lowercase hex characters.';
  }
  if (typeof m.signature !== 'string' || !m.signature.trim()) {
    return 'The manifest has no "signature". Was it made by release.mjs sign?';
  }
  return {
    version: m.version.trim(),
    size: m.size,
    sha256: m.sha256,
    signature: m.signature,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : undefined,
    keyFingerprint: typeof m.keyFingerprint === 'string' ? m.keyFingerprint : undefined,
  };
}

/* ============================================================
   Page
   ============================================================ */

export default function FirmwarePage() {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [devices, setDevices] = useState<OtaDevice[] | null>(null);
  const [releasesErr, setReleasesErr] = useState<string | null>(null);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busyRelease, setBusyRelease] = useState<string | null>(null);
  const [busySerial, setBusySerial] = useState<string | null>(null);
  const [testFor, setTestFor] = useState<Release | null>(null);

  const seq = useRef(0);
  const inFlight = useRef(false);

  // Background refreshes skip while a request is running; explicit ones always
  // run and win (only the newest request's answer is applied).
  const load = useCallback(async (background = false) => {
    if (background && inFlight.current) return;
    const mine = ++seq.current;
    inFlight.current = true;
    setLoading(true);
    const [r, d] = await Promise.allSettled([
      api.get<{ data: Release[] }>('/firmware/admin/releases'),
      api.get<{ data: OtaDevice[] }>('/firmware/admin/devices'),
    ]);
    if (mine !== seq.current) return;
    if (r.status === 'fulfilled') {
      setReleases(Array.isArray(r.value.data?.data) ? r.value.data.data : []);
      setReleasesErr(null);
    } else {
      setReleasesErr(loadError(r.reason));
    }
    if (d.status === 'fulfilled') {
      setDevices(Array.isArray(d.value.data?.data) ? d.value.data.data : []);
      setDevicesErr(null);
    } else {
      setDevicesErr(loadError(d.reason));
    }
    if (r.status === 'fulfilled' || d.status === 'fulfilled') setUpdatedAt(new Date());
    inFlight.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const stats = useMemo(() => {
    const list = devices ?? [];
    return {
      total: list.length,
      online: list.filter((d) => d.isOnline).length,
      updating: list.filter((d) => d.otaStatus === 'OFFERED' || d.otaStatus === 'DOWNLOADING').length,
      problems: list.filter((d) => needsRetry(d.otaStatus)).length,
      old: list.filter((d) => !canUpdateRemotely(d.firmwareVersion)).length,
    };
  }, [devices]);

  /** PATCH a release. Returns null on success, else the error message. */
  async function patchRelease(
    r: Release,
    body: Partial<Pick<Release, 'rollout' | 'testSerials' | 'installNow' | 'notes'>>,
    success: string,
    opts: { toastError?: boolean } = { toastError: true }
  ): Promise<string | null> {
    setBusyRelease(r.id);
    try {
      await api.patch(`/firmware/admin/releases/${encodeURIComponent(r.id)}`, body);
      toast.success(success);
      await load();
      return null;
    } catch (e) {
      const msg = apiErrorMessage(e);
      if (opts.toastError) toast.error(msg, `Could not change ${r.version}`);
      return msg;
    } finally {
      setBusyRelease(null);
    }
  }

  async function setOff(r: Release) {
    if (r.rollout === 'OFF') return;
    await patchRelease(r, { rollout: 'OFF' }, `${r.version} is off. No purifier is offered it any more.`);
  }

  async function setAll(r: Release) {
    if (r.rollout === 'ALL') return;
    const lines: string[] = [];
    if (devices) {
      const notOnIt = devices.filter((d) => d.firmwareVersion !== r.version);
      const reachable = notOnIt.filter((d) => canUpdateRemotely(d.firmwareVersion));
      const tooOld = notOnIt.length - reachable.length;
      const online = reachable.filter((d) => d.isOnline).length;
      lines.push(
        `It will be offered to ${plural(reachable.length, 'purifier')} that ${reachable.length === 1 ? 'is' : 'are'} not on ${r.version} yet (${online} online right now).`
      );
      if (tooOld > 0) {
        lines.push(
          `${plural(tooOld, 'more purifier')} run${tooOld === 1 ? 's' : ''} firmware older than ${OTA_MIN_VERSION} (or never reported a version). They can't update until they are flashed by USB once.`
        );
      }
    } else {
      lines.push("The purifier list couldn't be loaded, so the number of purifiers is unknown.");
    }
    lines.push(
      r.installNow
        ? '"Install now" is ON: every purifier installs as soon as it checks in, even in the daytime. Each one restarts, so its water stops for a few seconds. Turn "Install now" off first unless you mean it.'
        : 'They install at night, between 2 and 5 AM IST, while nobody is using water.'
    );
    if ((r.counts?.installed ?? 0) === 0 && (r.counts?.onThisVersion ?? 0) === 0) {
      lines.push('No purifier has installed this release yet. Test it first with "Test".');
    }
    const others = (releases ?? []).filter((x) => x.id !== r.id && x.rollout === 'ALL').map((x) => x.version);
    if (others.length) {
      lines.push(
        `Note: ${others.join(', ')} ${others.length === 1 ? 'is' : 'are'} also set to All purifiers. Each purifier gets the most recently uploaded release that is switched on for it.`
      );
    }

    const ok = await confirmDialog({
      title: `Send ${r.version} to all purifiers?`,
      message: lines.join('\n\n'),
      confirmLabel: 'Send to all purifiers',
      destructive: r.installNow || (r.counts?.installed ?? 0) === 0,
    });
    if (!ok) return;
    await patchRelease(
      r,
      { rollout: 'ALL' },
      r.installNow
        ? `${r.version} is going to all purifiers now.`
        : `${r.version} is going to all purifiers. They install tonight, 2–5 AM IST.`
    );
  }

  async function toggleInstallNow(r: Release) {
    if (!r.installNow) {
      const ok = await confirmDialog({
        title: `Turn on "Install now" for ${r.version}?`,
        message:
          'For testing only. Purifiers that are offered this release install it at their next check-in instead of waiting for the night window (2–5 AM IST). The purifier restarts, so its water stops for a few seconds.' +
          (r.rollout === 'ALL'
            ? '\n\nThis release is set to All purifiers, so EVERY purifier will install it during the day.'
            : ''),
        confirmLabel: 'Turn on',
        destructive: true,
      });
      if (!ok) return;
    }
    await patchRelease(
      r,
      { installNow: !r.installNow },
      r.installNow ? `${r.version}: back to installing at night (2–5 AM IST).` : `${r.version}: installs right away now.`
    );
  }

  async function retry(d: OtaDevice) {
    if (d.otaStatus === 'ROLLED_BACK') {
      const ok = await confirmDialog({
        title: `Retry the update on ${d.serial}?`,
        message:
          'This purifier went back to its old firmware: the new one crashed, or could not reach the server for 10 minutes. Retry only if you fixed the cause (for example its Wi-Fi), or after testing a fixed release.',
        confirmLabel: 'Retry',
      });
      if (!ok) return;
    }
    setBusySerial(d.serial);
    try {
      await api.post(`/firmware/admin/devices/${encodeURIComponent(d.serial)}/retry`);
      toast.success(`${d.serial} will try the update again at its next check-in.`);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e), `Could not retry ${d.serial}`);
    } finally {
      setBusySerial(null);
    }
  }

  return (
    <Shell title="Firmware updates" eyebrow="Operations · Purifier chips">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="text-xs text-ink-muted">
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · refreshes every 30 s`
            : loading
            ? 'Loading…'
            : "Couldn't load yet · trying again every 30 s"}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Purifiers" value={devices ? stats.total : '—'} sub={devices ? `${stats.online} online` : undefined} />
        <Stat label="Updating" value={devices ? stats.updating : '—'} sub="Offered or downloading" />
        <Stat
          label="Need attention"
          value={devices ? stats.problems : '—'}
          sub="Failed or rolled back"
          trend={stats.problems > 0 ? 'down' : 'flat'}
        />
        <Stat label={`Older than ${OTA_MIN_VERSION}`} value={devices ? stats.old : '—'} sub="Need one USB flash" />
        <Stat
          label="Live release"
          value={releases?.find((r) => r.rollout === 'ALL')?.version ?? '—'}
          sub="Set to All purifiers"
        />
      </div>

      <UploadCard existingVersions={(releases ?? []).map((r) => r.version)} onUploaded={() => load()} />

      <Card className="mt-6">
        <SectionTitle
          title="Releases"
          sub='New uploads start Off. Test on one purifier with "Install now", then send to All purifiers.'
        />
        {releasesErr ? <ErrorNote message={releasesErr} stale={releases !== null} onRetry={() => void load()} /> : null}
        {releases === null ? (
          releasesErr ? null : <Muted>Loading…</Muted>
        ) : releases.length === 0 ? (
          <Muted>
            No releases yet. Make one with <code className="font-mono">node tools/release.mjs sign</code>, then upload
            it above.
          </Muted>
        ) : (
          <ScrollTable
            headers={['Version', 'Size', 'Uploaded', 'Notes', 'Rollout', 'Purifiers', 'Change rollout']}
            rows={releases.map((r) => [
              <div key="v">
                <div className="font-bold">{r.version}</div>
                <div className="text-[11px] text-ink-muted font-mono whitespace-nowrap" title={r.sha256}>
                  sha {r.sha256?.slice(0, 12)}…
                </div>
              </div>,
              <span key="s" className="text-xs whitespace-nowrap">
                {formatMB(r.sizeBytes)}
              </span>,
              <span key="u" className="text-xs whitespace-nowrap">
                {formatDateTime(r.createdAt)}
              </span>,
              <div key="n" className="text-xs text-ink-soft max-w-[220px] line-clamp-3 break-words" title={r.notes ?? ''}>
                {r.notes || <span className="text-ink-muted">—</span>}
              </div>,
              <RolloutCell key="r" r={r} />,
              <CountsCell key="c" counts={r.counts} />,
              <div key="a" className="space-y-2 min-w-[250px]">
                <div className="inline-flex p-1 rounded-xl border border-line bg-surface-warm">
                  {(
                    [
                      ['OFF', 'Off', () => void setOff(r)],
                      ['TEST', 'Test', () => setTestFor(r)],
                      ['ALL', 'All purifiers', () => void setAll(r)],
                    ] as Array<[Rollout, string, () => void]>
                  ).map(([key, label, onClick]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={onClick}
                      disabled={busyRelease === r.id}
                      title={key === 'TEST' && r.rollout === 'TEST' ? 'Edit the test list' : undefined}
                      className={
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ' +
                        (r.rollout === key ? 'bg-white shadow-soft text-ink' : 'text-ink-muted hover:text-ink')
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Switch
                  checked={r.installNow}
                  disabled={busyRelease === r.id}
                  onChange={() => void toggleInstallNow(r)}
                  label="Install now (skip night window)"
                />
                {r.installNow ? (
                  <div className="text-[11px] font-bold text-danger">Testing only: installs during the day.</div>
                ) : null}
              </div>,
            ])}
          />
        )}
      </Card>

      <PurifiersCard
        devices={devices}
        error={devicesErr}
        busySerial={busySerial}
        onRetry={(d) => void retry(d)}
        onReload={() => void load()}
      />

      <TestDrawer
        release={testFor}
        devices={devices}
        onClose={() => setTestFor(null)}
        onSave={async (r, serials) => {
          const err = await patchRelease(
            r,
            { rollout: 'TEST', testSerials: serials },
            `${r.version} is on test for ${plural(serials.length, 'purifier')}.`,
            { toastError: false }
          );
          if (!err) setTestFor(null);
          return err;
        }}
      />
    </Shell>
  );
}

/* ============================================================
   Upload card
   ============================================================ */

function UploadCard({
  existingVersions,
  onUploaded,
}: {
  existingVersions: string[];
  onUploaded: () => Promise<void>;
}) {
  const [bin, setBin] = useState<File | null>(null);
  const [binMagicOk, setBinMagicOk] = useState<boolean | null>(null);
  const [binSha, setBinSha] = useState<string | null>(null); // hex, 'unavailable', or null while unknown
  const [hashing, setHashing] = useState(false);
  const [manFile, setManFile] = useState<File | null>(null);
  const [manText, setManText] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manErr, setManErr] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const binToken = useRef(0);

  function reset() {
    binToken.current++;
    setBin(null);
    setBinMagicOk(null);
    setBinSha(null);
    setHashing(false);
    setManFile(null);
    setManText(null);
    setManifest(null);
    setManErr(null);
    setNotes('');
    setProgress(null);
    setUploadErr(null);
    setResetKey((k) => k + 1);
  }

  async function pickBin(f: File) {
    const mine = ++binToken.current;
    setBin(f);
    setBinMagicOk(null);
    setBinSha(null);
    setUploadErr(null);
    try {
      const head = new Uint8Array(await f.slice(0, 1).arrayBuffer());
      if (mine !== binToken.current) return;
      setBinMagicOk(head[0] === 0xe9);
      const subtle = typeof window !== 'undefined' && window.isSecureContext ? window.crypto?.subtle : undefined;
      if (!subtle) {
        setBinSha('unavailable');
        return;
      }
      setHashing(true);
      const digest = await subtle.digest('SHA-256', await f.arrayBuffer());
      if (mine !== binToken.current) return;
      setBinSha(toHex(digest));
    } catch {
      if (mine === binToken.current) setBinSha('unavailable');
    } finally {
      if (mine === binToken.current) setHashing(false);
    }
  }

  async function pickManifest(f: File) {
    setManFile(f);
    setManText(null);
    setManifest(null);
    setManErr(null);
    setUploadErr(null);
    if (f.size > 64 * 1024) {
      setManErr('This file is too big to be a release manifest. Pick the .release.json file.');
      return;
    }
    try {
      const text = await f.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setManErr('Not valid JSON. Pick the .release.json made by release.mjs sign.');
        return;
      }
      const m = validateManifest(parsed);
      if (typeof m === 'string') {
        setManErr(m);
        return;
      }
      setManifest(m);
      setManText(text);
    } catch {
      setManErr('Could not read this file.');
    }
  }

  // Blocking problems stop the upload; warnings are shown but don't.
  const problems: string[] = [];
  const warnings: string[] = [];
  if (manErr) problems.push(manErr);
  if (bin && binMagicOk === false) {
    problems.push("The .bin doesn't start with byte 0xE9, so it isn't an ESP32 app image. Use the file from dist/.");
  }
  if (bin && manifest) {
    if (bin.size !== manifest.size) {
      problems.push(
        `File size differs: the .bin is ${bin.size.toLocaleString('en-IN')} bytes but the manifest says ${manifest.size.toLocaleString('en-IN')}. These two files don't belong together.`
      );
    }
    if (binSha && binSha !== 'unavailable' && binSha !== manifest.sha256) {
      problems.push("The .bin's SHA-256 doesn't match the manifest. Pick the matching pair from dist/.");
    }
    const nameVer = /smartro_valve-(\d+\.\d+\.\d+)\.bin$/i.exec(bin.name)?.[1];
    if (nameVer && nameVer !== manifest.version) {
      warnings.push(`The .bin file name says ${nameVer} but the manifest says ${manifest.version}.`);
    }
  }
  if (manifest && existingVersions.includes(manifest.version)) {
    problems.push(`Version ${manifest.version} is already uploaded. Raise FW_VERSION, build and sign again.`);
  }
  if (manifest && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    warnings.push(`Version "${manifest.version}" doesn't look like 1.2.3.`);
  }
  if (bin && bin.size > APP_SLOT_BYTES) {
    warnings.push(`The .bin is bigger than the purifier's update slot (${formatMB(APP_SLOT_BYTES)}); a purifier can't install it.`);
  }
  if (bin && manifest && binSha === 'unavailable') {
    warnings.push("This browser can't check the SHA-256 here (it needs HTTPS). The server checks it on upload.");
  }

  const ready = Boolean(bin && manifest && manText) && problems.length === 0 && !hashing && !busy;

  async function upload() {
    if (!bin || !manifest || !manText) return;
    setBusy(true);
    setUploadErr(null);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', bin, bin.name);
      fd.append('manifest', manText);
      if (notes.trim()) fd.append('notes', notes.trim());
      await api.post('/firmware/admin/releases', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180_000,
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      toast.success(`${manifest.version} is uploaded and Off. Next: click "Test" and enter your test purifier.`, 'Release uploaded');
      reset();
      await onUploaded();
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg = apiErrorMessage(e);
      const title = status === 409 ? `Version ${manifest.version} already exists` : 'Upload failed';
      setUploadErr(`${title}: ${msg}`);
      toast.error(msg, title);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Upload a release"
        sub={
          <>
            Make both files with <code className="font-mono">node tools/release.mjs sign</code> (in
            Android_SmartRO_Firmware). They are in its <code className="font-mono">dist/</code> folder.
          </>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FileDrop
              key={`bin-${resetKey}`}
              label="1. Firmware (.bin)"
              hint="smartro_valve-x.y.z.bin"
              accept=".bin,application/octet-stream"
              fileName={bin ? `${bin.name} · ${formatMB(bin.size)}` : null}
              onFile={(f) => void pickBin(f)}
            />
            <FileDrop
              key={`man-${resetKey}`}
              label="2. Manifest (.release.json)"
              hint="smartro_valve-x.y.z.release.json"
              accept=".json,application/json"
              fileName={manFile?.name ?? null}
              onFile={(f) => void pickManifest(f)}
            />
          </div>
          <FormField label="Notes (optional)" hint="What changed, for your own records">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fixes Wi-Fi reconnect after router restart" />
          </FormField>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => void upload()} disabled={!ready}>
              {busy ? (progress != null && progress < 100 ? `Uploading ${progress}%…` : 'Checking on server…') : 'Upload'}
            </Button>
            {bin || manFile || notes ? (
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Clear
              </Button>
            ) : null}
          </div>
          {uploadErr ? <Banner tone="danger">{uploadErr}</Banner> : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface-warm/50 p-4 text-sm">
          <div className="text-eyebrow uppercase text-ink-muted mb-3">Before you upload</div>
          {!manifest && !bin ? (
            <div className="text-ink-muted text-xs">Pick both files. Their details and checks show up here.</div>
          ) : (
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-ink-muted">Version</dt>
              <dd className="font-bold">{manifest?.version ?? '—'}</dd>
              <dt className="text-ink-muted">Size</dt>
              <dd>
                {manifest ? `${formatMB(manifest.size)} (${manifest.size.toLocaleString('en-IN')} bytes)` : '—'}
                {bin && manifest && bin.size === manifest.size ? <span className="text-success font-bold"> · matches .bin</span> : null}
              </dd>
              <dt className="text-ink-muted">SHA-256</dt>
              <dd className="font-mono break-all">
                {manifest ? `${manifest.sha256.slice(0, 16)}…` : '—'}
                {hashing ? <span className="text-ink-muted font-sans"> · checking .bin…</span> : null}
                {manifest && binSha && binSha !== 'unavailable' && binSha === manifest.sha256 ? (
                  <span className="text-success font-bold font-sans"> · matches .bin</span>
                ) : null}
              </dd>
              <dt className="text-ink-muted">Signed</dt>
              <dd>{manifest?.createdAt ? formatDateTime(manifest.createdAt) : '—'}</dd>
              <dt className="text-ink-muted">Key</dt>
              <dd className="font-mono">{manifest?.keyFingerprint ?? '—'}</dd>
            </dl>
          )}
          {problems.length || warnings.length ? (
            <div className="mt-4 space-y-2">
              {problems.map((p) => (
                <Banner key={p} tone="danger">
                  {p}
                </Banner>
              ))}
              {warnings.map((w) => (
                <Banner key={w} tone="warning">
                  {w}
                </Banner>
              ))}
            </div>
          ) : null}
          <div className="mt-4 text-[11px] text-ink-muted">
            The server checks the signature, size and SHA-256 again. Purifiers check the signature before installing.
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   Release table cells
   ============================================================ */

function RolloutCell({ r }: { r: Release }) {
  const serials = r.testSerials ?? [];
  return (
    <div className="space-y-1.5">
      {r.rollout === 'ALL' ? (
        <Pill tone="success" dot className="whitespace-nowrap">
          All purifiers
        </Pill>
      ) : r.rollout === 'TEST' ? (
        <Pill tone="warning" dot className="whitespace-nowrap">
          Test · {plural(serials.length, 'purifier')}
        </Pill>
      ) : (
        <Pill tone="neutral">Off</Pill>
      )}
      {r.rollout === 'TEST' && serials.length ? (
        <div className="text-[11px] text-ink-muted font-mono max-w-[180px] break-words">{serials.join(', ')}</div>
      ) : null}
      {r.installNow ? (
        <div>
          <Pill tone="danger" size="sm">
            Install now
          </Pill>
        </div>
      ) : null}
    </div>
  );
}

function CountsCell({ counts }: { counts?: Partial<ReleaseCounts> | null }) {
  const c = counts ?? {};
  const item = (label: string, n: number | undefined, tone?: string) => (
    <div className="flex justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-bold tabular-nums ${n ? tone ?? '' : 'text-ink-muted'}`}>{n ?? 0}</span>
    </div>
  );
  return (
    <div className="text-[11px] min-w-[130px] space-y-0.5">
      {item('On this version', c.onThisVersion, 'text-ink')}
      {item('Offered', c.offered)}
      {item('Downloading', c.downloading)}
      {item('Installed', c.installed, 'text-success')}
      {item('Failed', c.failed, 'text-danger')}
    </div>
  );
}

/* ============================================================
   Purifiers card
   ============================================================ */

const DEVICE_FILTERS = [
  ['ALL', 'All'],
  ['UPDATING', 'Updating'],
  ['PROBLEMS', 'Failed / rolled back'],
  ['OLD', `Older than ${OTA_MIN_VERSION}`],
] as const;
type DeviceFilter = (typeof DEVICE_FILTERS)[number][0];

function deviceRank(d: OtaDevice): number {
  if (needsRetry(d.otaStatus)) return 0;
  if (d.otaStatus === 'OFFERED' || d.otaStatus === 'DOWNLOADING') return 1;
  return 2;
}

function PurifiersCard({
  devices,
  error,
  busySerial,
  onRetry,
  onReload,
}: {
  devices: OtaDevice[] | null;
  error: string | null;
  busySerial: string | null;
  onRetry: (d: OtaDevice) => void;
  onReload: () => void;
}) {
  const [filter, setFilter] = useState<DeviceFilter>('ALL');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (devices ?? [])
      .filter((d) => {
        if (filter === 'UPDATING' && d.otaStatus !== 'OFFERED' && d.otaStatus !== 'DOWNLOADING') return false;
        if (filter === 'PROBLEMS' && !needsRetry(d.otaStatus)) return false;
        if (filter === 'OLD' && canUpdateRemotely(d.firmwareVersion)) return false;
        if (!q) return true;
        return [d.serial, d.firmwareVersion, d.otaReleaseVersion, d.otaStatus, d.otaError]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => deviceRank(a) - deviceRank(b) || a.serial.localeCompare(b.serial));
  }, [devices, filter, query]);

  return (
    <Card className="mt-6">
      <SectionTitle
        title="Purifiers"
        sub="Each purifier's firmware and its latest update. Failed ones stop after 3 tries until you press Retry."
      />
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <div className="inline-flex p-1 rounded-xl border border-line bg-surface-warm flex-wrap">
          {DEVICE_FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all ' +
                (filter === key ? 'bg-white shadow-soft text-ink' : 'text-ink-muted hover:text-ink')
              }
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search serial, version, error…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 260, maxWidth: 360 }}
        />
      </div>

      {error ? <ErrorNote message={error} stale={devices !== null} onRetry={onReload} /> : null}
      {devices === null ? (
        error ? null : <Muted>Loading…</Muted>
      ) : devices.length === 0 ? (
        <Muted>No purifiers yet.</Muted>
      ) : shown.length === 0 ? (
        <Muted>No purifiers match that filter.</Muted>
      ) : (
        <ScrollTable
          headers={['Purifier', 'Version', 'Update', 'Error', 'Attempts', 'Last seen', '']}
          rows={shown.map((d) => {
            const st = statusInfo(d.otaStatus);
            const attempts = d.otaAttempts ?? 0;
            return [
              <span key="s" className="font-bold tracking-wider whitespace-nowrap">
                {d.serial}
              </span>,
              <div key="v" className="text-xs">
                <div className="font-bold">{d.firmwareVersion ?? '—'}</div>
                {!canUpdateRemotely(d.firmwareVersion) ? (
                  <div className="text-[11px] text-warning font-bold whitespace-nowrap">USB flash needed</div>
                ) : null}
              </div>,
              st ? (
                <div key="u" className="text-xs space-y-1">
                  <Pill tone={st.tone} dot>
                    {st.label}
                  </Pill>
                  <div className="text-ink-muted whitespace-nowrap">
                    {d.otaReleaseVersion ? `to ${d.otaReleaseVersion}` : ''}
                    {d.otaReleaseVersion && d.otaUpdatedAt ? ' · ' : ''}
                    {d.otaUpdatedAt ? formatDateTime(d.otaUpdatedAt) : ''}
                  </div>
                </div>
              ) : (
                <span key="u" className="text-xs text-ink-muted">
                  No update yet
                </span>
              ),
              d.otaError ? (
                <div key="e" className="text-xs text-danger max-w-[260px] break-words line-clamp-3" title={d.otaError}>
                  {d.otaError}
                </div>
              ) : (
                <span key="e" className="text-xs text-ink-muted">
                  —
                </span>
              ),
              <div key="t" className="text-xs">
                <span className="font-bold tabular-nums">{attempts}</span>
                {d.otaStatus === 'FAILED' && attempts >= MAX_ATTEMPTS ? (
                  <div className="text-[11px] text-ink-muted whitespace-nowrap">Stopped trying</div>
                ) : null}
              </div>,
              <div key="h" className="text-xs">
                {d.lastHeartbeatAt ? (
                  <>
                    <Pill tone={d.isOnline ? 'success' : 'warning'} size="sm" dot>
                      {d.isOnline ? 'Online' : 'Offline'}
                    </Pill>
                    <div className="text-ink-muted mt-1 whitespace-nowrap">{formatDateTime(d.lastHeartbeatAt)}</div>
                  </>
                ) : (
                  <Pill tone="neutral" size="sm">
                    Never seen
                  </Pill>
                )}
              </div>,
              needsRetry(d.otaStatus) ? (
                <Button key="a" size="sm" variant="outline" disabled={busySerial === d.serial} onClick={() => onRetry(d)}>
                  {busySerial === d.serial ? '…' : 'Retry'}
                </Button>
              ) : (
                <span key="a" />
              ),
            ];
          })}
        />
      )}
    </Card>
  );
}

/* ============================================================
   Test drawer
   ============================================================ */

function TestDrawer({
  release,
  devices,
  onClose,
  onSave,
}: {
  release: Release | null;
  devices: OtaDevice[] | null;
  onClose: () => void;
  onSave: (r: Release, serials: string[]) => Promise<string | null>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (release) {
      setText((release.testSerials ?? []).join(', '));
      setErr(null);
      setBusy(false);
    }
  }, [release]);

  if (!release) return null;
  const serials = parseSerials(text);
  const bySerial = new Map((devices ?? []).map((d) => [d.serial.toUpperCase(), d]));

  async function save() {
    if (!release || serials.length === 0) return;
    setBusy(true);
    setErr(null);
    const e = await onSave(release, serials);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <Drawer open onClose={onClose} title={`Test ${release.version}`} width="narrow">
      <div className="space-y-4">
        <div className="text-sm text-ink-soft">
          Only the purifiers listed here are offered {release.version}. Everyone else stays as they are.
        </div>
        <FormField label="Purifier serials" hint="Separate with commas">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="SR-TEST-0001" autoFocus />
        </FormField>

        {serials.length ? (
          <div className="space-y-1.5">
            {serials.map((s) => {
              const d = bySerial.get(s);
              return (
                <div key={s} className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-surface-warm">
                  <span className="font-bold font-mono">{s}</span>
                  {devices === null ? null : d ? (
                    <span className="text-ink-muted">
                      fw {d.firmwareVersion ?? '?'} · {d.isOnline ? 'online' : 'offline'}
                      {!canUpdateRemotely(d.firmwareVersion) ? (
                        <span className="text-warning font-bold"> · needs USB flash first</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-warning font-bold">not found</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {!release.installNow ? (
          <Banner tone="info">
            To test right away, also turn on &quot;Install now&quot; for this release. Otherwise the test purifier waits for the
            night window (2–5 AM IST). It sees the offer at its next check-in; to make it check now, unplug it for a few
            seconds or type <code className="font-mono">reboot</code> in its serial monitor.
          </Banner>
        ) : null}

        {err ? <Banner tone="danger">{err}</Banner> : null}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || serials.length === 0}>
            {busy ? 'Saving…' : `Test on ${plural(serials.length, 'purifier')}`}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

/* ============================================================
   Small pieces
   ============================================================ */

function SectionTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="font-display text-title-md font-bold text-ink">{title}</div>
      {sub ? <div className="text-xs text-ink-muted mt-1">{sub}</div> : null}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <div className="text-sm text-ink-muted text-center py-10">{children}</div>;
}

function Banner({ tone, children }: { tone: 'danger' | 'warning' | 'info'; children: ReactNode }) {
  const skin =
    tone === 'danger' ? 'bg-danger-soft text-danger' : tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand-ink';
  return <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${skin}`}>{children}</div>;
}

function ErrorNote({ message, stale, onRetry }: { message: string; stale: boolean; onRetry: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-danger-soft">
      <div className="text-sm font-semibold text-danger">
        {stale ? "Couldn't refresh (showing the last data): " : ''}
        {message}
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft disabled:opacity-50"
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-danger' : 'bg-line-strong'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

/** Same look as components/UI Table, but scrolls sideways instead of clipping wide rows. */
function ScrollTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="bg-white border border-line rounded-3xl overflow-x-auto shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-warm">
            {headers.map((h, i) => (
              <th key={i} className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className={`border-t border-line/70 hover:bg-surface-warm/60 ${i % 2 === 1 ? 'bg-surface-warm/30' : ''}`}
            >
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
