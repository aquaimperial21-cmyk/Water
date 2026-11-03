'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Button, Card, Drawer, EmptyState, FormField, Input, Pill } from '../../components/UI';
import { confirmDialog, toast } from '../../components/Feedback';
import { api, apiErrorMessage, formatDate } from '../../lib/api';

interface Plan {
  id: string;
  name: string;
  durationMonths: number;
  isActive: boolean;
  createdAt: string;
  _count: { prices: number; subscriptions: number };
}

// Mirrors the backend's plan schema (admin.ts planCreateSchema). Lengths are calendar months.
const NAME_MAX = 60;
const MIN_MONTHS = 1;
const MAX_MONTHS = 36;

const QUICK_MONTHS = [1, 3, 6, 12];
// Names the seed uses for the standard lengths; anything else gets "N months".
const SUGGESTED_NAME: Record<number, string> = { 1: 'Monthly', 3: 'Quarterly', 6: 'Half-yearly', 12: 'Annual' };
const suggestName = (months: number) => SUGGESTED_NAME[months] ?? `${months} months`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The API answers bad input with { code: 'VALIDATION_ERROR', message: 'Invalid request', fields }.
// Fold the field messages in so the admin sees what was wrong.
function planErrorMessage(e: unknown): string {
  const fields = (e as { response?: { data?: { error?: { fields?: Record<string, string[] | undefined> } } } })
    ?.response?.data?.error?.fields;
  const detail = fields
    ? Object.entries(fields)
        .filter(([, msgs]) => msgs && msgs.length > 0)
        .map(([field, msgs]) => `${field}: ${msgs!.join(', ')}`)
        .join('; ')
    : '';
  return detail ? `${apiErrorMessage(e)} (${detail})` : apiErrorMessage(e);
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  // New-plan drawer
  const [showForm, setShowForm] = useState(false);
  const [monthsText, setMonthsText] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; durationMonths: number } | null>(null);

  async function load() {
    try {
      const r = await api.get<{ data: Plan[] }>('/admin/plans');
      setPlans(r.data.data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(apiErrorMessage(e));
    }
  }
  useEffect(() => { void load(); }, []);

  /* ---------------- New plan ---------------- */

  function openForm() {
    setMonthsText('');
    setName('');
    setNameTouched(false);
    setFormErr(null);
    setShowForm(true);
  }

  function pickMonths(m: number) {
    setMonthsText(String(m));
    if (!nameTouched) setName(suggestName(m));
  }

  const months = Number(monthsText);
  const monthsValid =
    monthsText.trim() !== '' && Number.isInteger(months) && months >= MIN_MONTHS && months <= MAX_MONTHS;
  const activeWithLength = (m: number) => plans?.find((p) => p.isActive && p.durationMonths === m);
  const clash = monthsValid ? activeWithLength(months) : undefined;
  const nameValid = name.trim().length >= 1 && name.trim().length <= NAME_MAX;
  const formValid = monthsValid && !clash && nameValid;

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!formValid || creating) return;
    setCreating(true);
    setFormErr(null);
    try {
      const r = await api.post<{ data: Plan }>('/admin/plans', { name: name.trim(), durationMonths: months });
      setCreated({ name: r.data.data.name, durationMonths: r.data.data.durationMonths });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormErr(planErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /* ---------------- Rename ---------------- */

  function startRename(p: Plan) {
    setRenamingId(p.id);
    setDraftName(p.name);
  }

  async function saveRename(p: Plan) {
    const next = draftName.trim();
    if (next.length < 1 || next.length > NAME_MAX) return;
    if (next === p.name) {
      setRenamingId(null);
      return;
    }
    setBusyId(p.id);
    try {
      await api.patch(`/admin/plans/${p.id}`, { name: next });
      toast.success(`"${p.name}" is now "${next}"`, 'Plan renamed');
      setRenamingId(null);
      await load();
    } catch (e) {
      toast.error(planErrorMessage(e), 'Could not rename plan');
    } finally {
      setBusyId(null);
    }
  }

  /* ---------------- Switch on / off ---------------- */

  async function setActive(p: Plan, isActive: boolean) {
    if (!isActive && p._count.subscriptions > 0) {
      const ok = await confirmDialog({
        title: `Switch off "${p.name}"?`,
        message: `It has ${plural(p._count.subscriptions, 'subscription')}. Existing customers keep their plan until it expires; new customers can't pick it.`,
        confirmLabel: 'Switch off',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusyId(p.id);
    try {
      await api.patch(`/admin/plans/${p.id}`, { isActive });
      if (!isActive) {
        toast.success("New customers can't pick it any more.", `"${p.name}" switched off`);
      } else if (p._count.prices === 0) {
        toast.warning('Set its prices on the Products page so customers can book it.', `"${p.name}" switched on`);
      } else {
        toast.success('Customers can pick it again.', `"${p.name}" switched on`);
      }
      await load();
    } catch (e) {
      toast.error(planErrorMessage(e), isActive ? 'Could not switch plan on' : 'Could not switch plan off');
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = plans?.filter((p) => p.isActive).length ?? 0;

  return (
    <Shell title="Plans" eyebrow="Catalog">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="text-sm text-ink-muted">
          {plans ? `${plural(plans.length, 'plan')} · ${activeCount} active` : loadErr ? '' : 'Loading…'}
        </div>
        <Button onClick={openForm} leadingIcon={<span className="text-base leading-none">＋</span>}>
          New plan
        </Button>
      </div>

      {created ? (
        <div className="mb-4 px-4 py-3 rounded-xl bg-success-soft border border-success/30 text-success text-sm font-bold flex items-start justify-between gap-3">
          <span>
            ✓ Created &ldquo;{created.name}&rdquo; ({plural(created.durationMonths, 'month')}). Next, set its prices on the{' '}
            <Link href="/products" className="underline hover:no-underline">
              Products page
            </Link>{' '}
            — customers can&apos;t book it until it has a price.
          </span>
          <button onClick={() => setCreated(null)} aria-label="Dismiss">✕</button>
        </div>
      ) : null}

      {loadErr ? (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm font-bold flex items-center justify-between gap-3">
          <span>Could not load plans: {loadErr}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!plans ? (
        loadErr ? null : (
          <Card>
            <div className="text-ink-muted text-sm">Loading plans…</div>
          </Card>
        )
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create the first rental plan customers can pick, then set its prices on the Products page."
          action={<Button onClick={openForm}>New plan</Button>}
        />
      ) : (
        <>
          <div className="rounded-3xl bg-white border border-line shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-warm">
                  <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Name</th>
                  <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Length</th>
                  <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Status</th>
                  <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Price rows</th>
                  <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3">Subscriptions</th>
                  <th className="text-left text-eyebrow uppercase text-ink-muted px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p, i) => {
                  const renaming = renamingId === p.id;
                  const rowBusy = busyId === p.id;
                  const draftValid = draftName.trim().length >= 1;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-line/70 hover:bg-surface-warm/60 ${i % 2 === 1 ? 'bg-surface-warm/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {renaming ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={draftName}
                              maxLength={NAME_MAX}
                              disabled={rowBusy}
                              aria-label={`New name for ${p.name}`}
                              onChange={(e) => setDraftName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void saveRename(p);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setRenamingId(null);
                                }
                              }}
                              className="max-w-[16rem]"
                            />
                            <Button size="sm" onClick={() => void saveRename(p)} disabled={rowBusy || !draftValid}>
                              {rowBusy ? 'Saving…' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)} disabled={rowBusy}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className={`font-bold ${p.isActive ? 'text-ink' : 'text-ink-muted'}`}>{p.name}</div>
                            <div className="text-[11px] text-ink-muted">Added {formatDate(p.createdAt)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold">{plural(p.durationMonths, 'month')}</td>
                      <td className="px-4 py-3">
                        {p.isActive ? (
                          <Pill tone="success" size="sm" dot>Active</Pill>
                        ) : (
                          <Pill tone="neutral" size="sm" dot>Off</Pill>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-bold">{p._count.prices}</span>
                          {p.isActive && p._count.prices === 0 ? (
                            <Link href="/products" className="text-[11px] font-bold text-warning hover:underline">
                              Set prices →
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold">{p._count.subscriptions}</td>
                      <td className="px-4 py-3">
                        {renaming ? null : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => startRename(p)} disabled={rowBusy}>
                              Rename
                            </Button>
                            <Button
                              size="sm"
                              variant={p.isActive ? 'outline' : 'soft'}
                              onClick={() => void setActive(p, !p.isActive)}
                              disabled={rowBusy}
                              className="min-w-[88px]"
                            >
                              {rowBusy ? 'Saving…' : p.isActive ? 'Switch off' : 'Switch on'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-ink-muted">
            Lengths are calendar months, so a month runs 28–31 days depending on when it starts, and the lock-in
            equals the plan length. A plan&apos;s length can&apos;t be changed: customers&apos; expiry dates are
            counted in months from it. To offer a different number of months, create a new plan and switch the old
            one off. Monthly prices per plan are set on the{' '}
            <Link href="/products" className="font-bold text-brand hover:underline">
              Products page
            </Link>
            .
          </p>
        </>
      )}

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New plan" width="narrow">
        <form onSubmit={submitForm} className="grid grid-cols-1 gap-5">
          {formErr ? (
            <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger font-bold">
              {formErr}
            </div>
          ) : null}

          <FormField
            label="Length (months)"
            required
            hint={`${MIN_MONTHS}–${MAX_MONTHS} calendar months`}
            error={
              monthsText.trim() !== '' && !monthsValid ? `Whole number, ${MIN_MONTHS}–${MAX_MONTHS}` : undefined
            }
          >
            {/* Input comes first so clicking the label focuses it, not a chip. */}
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_MONTHS}
              max={MAX_MONTHS}
              step={1}
              value={monthsText}
              onChange={(e) => setMonthsText(e.target.value)}
              onBlur={() => {
                if (!nameTouched && monthsValid) setName(suggestName(months));
              }}
              placeholder="1"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_MONTHS.map((m) => {
                const selected = monthsValid && months === m;
                const taken = activeWithLength(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMonths(m)}
                    disabled={Boolean(taken)}
                    title={taken ? `"${taken.name}" already uses ${plural(m, 'month')}` : undefined}
                    className={
                      'px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all border disabled:cursor-not-allowed disabled:opacity-50 ' +
                      (selected
                        ? 'bg-ink text-canvas border-ink shadow-soft'
                        : 'bg-white text-ink-soft border-line hover:border-line-strong hover:bg-surface-warm')
                    }
                  >
                    {plural(m, 'month')}{taken ? ' · in use' : ''}
                  </button>
                );
              })}
            </div>
            {clash ? (
              <div className="mt-2 text-[12px] font-bold text-danger">
                &ldquo;{clash.name}&rdquo; is already an active {clash.durationMonths}-month plan. Switch it off first, or
                pick another length.
              </div>
            ) : null}
          </FormField>

          <FormField label="Name" required hint={`Shown to customers · up to ${NAME_MAX} characters`}>
            <Input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              placeholder="Monthly"
            />
          </FormField>

          <div className="rounded-2xl border border-line bg-surface-warm/50 p-4 text-[12px] text-ink-soft leading-relaxed">
            <span className="font-bold text-ink">The number of months is fixed once the plan exists.</span>{' '}
            Customers&apos; expiry dates are counted in calendar months from it (and the lock-in equals the length),
            so offering a different length means creating a new plan and switching the old one off. After creating,
            set its monthly prices on the Products page.
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !formValid}>
              {creating ? 'Creating…' : 'Create plan'}
            </Button>
          </div>
        </form>
      </Drawer>
    </Shell>
  );
}
