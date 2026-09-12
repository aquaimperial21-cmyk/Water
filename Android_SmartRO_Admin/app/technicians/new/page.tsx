'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Shell } from '../../../components/Shell';
import { Button, Card, FormField, Input, Pill, Select } from '../../../components/UI';
import { api, apiErrorMessage } from '../../../lib/api';

interface FormState {
  // Personal
  fullName: string;
  phone: string;
  email: string;
  whatsappNumber: string;
  dateOfBirth: string;
  // Role
  employeeCode: string;
  zone: string;
  employmentType: 'PROBATION' | 'PERMANENT' | 'CONTRACT';
  dateOfJoining: string;
  monthlySalary: string;
  // Bank & ID
  aadhaar: string;
  pan: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  accountHolderName: string;
  // Address
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  // Emergency
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

const empty: FormState = {
  fullName: '', phone: '', email: '', whatsappNumber: '', dateOfBirth: '',
  employeeCode: '', zone: '', employmentType: 'PROBATION', dateOfJoining: '',
  monthlySalary: '',
  aadhaar: '', pan: '', bankAccountNumber: '', bankIfsc: '', bankName: '', accountHolderName: '',
  addressLine1: '', addressLine2: '', addressCity: '', addressState: '', addressPincode: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
};

const STEPS = ['Personal & role', 'Bank & ID', 'Address & emergency'] as const;
type Step = 0 | 1 | 2;

export default function NewTechnician() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; tempPassword?: string } | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function next() {
    setError(null);
    if (step === 0) {
      if (!form.fullName.trim() || !form.phone.trim() || !form.employeeCode.trim() || !form.zone.trim()) {
        setError('Name, phone, employee code and zone are required.');
        return;
      }
    }
    if (step === 1) {
      if (form.aadhaar && !/^\d{12}$/.test(form.aadhaar)) {
        setError('Aadhaar must be 12 digits.');
        return;
      }
      if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan)) {
        setError('PAN format: ABCDE1234F.');
        return;
      }
    }
    setStep((s) => Math.min(2, s + 1) as Step);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        employeeCode: form.employeeCode.trim(),
        zone: form.zone.trim(),
        employmentType: form.employmentType,
      };
      if (form.email) body.email = form.email.trim();
      if (form.whatsappNumber) body.whatsappNumber = form.whatsappNumber.trim();
      if (form.dateOfBirth) body.dateOfBirth = new Date(form.dateOfBirth).toISOString();
      if (form.dateOfJoining) body.dateOfJoining = new Date(form.dateOfJoining).toISOString();
      if (form.monthlySalary) body.monthlySalaryPaise = Math.round(Number(form.monthlySalary) * 100);
      if (form.aadhaar) body.aadhaar = form.aadhaar;
      if (form.pan) body.pan = form.pan.toUpperCase();
      if (form.bankAccountNumber) body.bankAccountNumber = form.bankAccountNumber;
      if (form.bankIfsc) body.bankIfsc = form.bankIfsc.toUpperCase();
      if (form.bankName) body.bankName = form.bankName;
      if (form.accountHolderName) body.accountHolderName = form.accountHolderName;
      if (form.addressLine1) body.addressLine1 = form.addressLine1;
      if (form.addressLine2) body.addressLine2 = form.addressLine2;
      if (form.addressCity) body.addressCity = form.addressCity;
      if (form.addressState) body.addressState = form.addressState;
      if (form.addressPincode) body.addressPincode = form.addressPincode;
      if (form.emergencyContactName) body.emergencyContactName = form.emergencyContactName;
      if (form.emergencyContactPhone) body.emergencyContactPhone = form.emergencyContactPhone;
      if (form.emergencyContactRelation) body.emergencyContactRelation = form.emergencyContactRelation;

      const r = await api.post('/admin/technicians', body);
      setDone({ id: r.data.data.id, tempPassword: r.data.data.tempPassword });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell title="Employee added" eyebrow="Team">
        <Card variant="elevated">
          <div className="text-eyebrow uppercase text-success">Created</div>
          <div className="font-display text-display-md font-extrabold mt-1">{form.fullName} is now on the team.</div>
          <p className="text-sm text-ink-muted mt-2">
            Their login is the email above (or their phone number) with the password below. They can change it on first sign-in.
          </p>
          {done.tempPassword ? (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-soft border border-brand-soft">
              <span className="text-eyebrow uppercase text-brand-ink">Temporary password</span>
              <code className="font-bold text-brand-ink tabular-nums">{done.tempPassword}</code>
            </div>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button onClick={() => router.push(`/technicians/${done.id}`)}>Open profile</Button>
            <Button variant="outline" onClick={() => router.push('/technicians')}>Back to roster</Button>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title="Add employee" eyebrow="Team · onboarding">
      <Card padding="lg" className="max-w-3xl">
        {/* Stepper */}
        <div className="flex items-center mb-6">
          {STEPS.map((label, i) => {
            const active = step === i;
            const passed = step > i;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center min-w-[100px]">
                  <div
                    className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold border-2 transition-all ${
                      passed
                        ? 'bg-brand text-white border-brand'
                        : active
                        ? 'bg-white text-brand border-brand shadow-glow'
                        : 'bg-white text-ink-muted border-line'
                    }`}
                  >
                    {passed ? '✓' : i + 1}
                  </div>
                  <span className={`mt-1.5 text-[11px] font-bold whitespace-nowrap ${active ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 ? (
                  <div className="flex-1 h-0.5 mx-2 mb-5 rounded-full overflow-hidden bg-line">
                    <div className={`h-full bg-brand transition-all duration-500 ${passed ? 'w-full' : 'w-0'}`} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger font-bold">
            {error}
          </div>
        ) : null}

        {step === 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Full name" required>
                <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. Ramesh Kumar" />
              </FormField>
              <FormField label="Phone (login + SMS)" required>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+919876543210" />
              </FormField>
              <FormField label="Email">
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ramesh@imperialaqua.in" />
              </FormField>
              <FormField label="WhatsApp number" hint="Used for daily schedule">
                <Input value={form.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} placeholder="+919876543210" />
              </FormField>
              <FormField label="Date of birth">
                <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </FormField>
            </div>

            <div className="border-t border-line my-5" />

            <div className="text-eyebrow uppercase text-ink-muted">Role</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Employee code" required>
                <Input value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value.toUpperCase())} placeholder="EMP-001" />
              </FormField>
              <FormField label="Zone" required>
                <Input value={form.zone} onChange={(e) => set('zone', e.target.value)} placeholder="Pune-Central" />
              </FormField>
              <FormField label="Employment type">
                <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value as FormState['employmentType'])}>
                  <option value="PROBATION">Probation</option>
                  <option value="PERMANENT">Permanent</option>
                  <option value="CONTRACT">Contract</option>
                </Select>
              </FormField>
              <FormField label="Date of joining">
                <Input type="date" value={form.dateOfJoining} onChange={(e) => set('dateOfJoining', e.target.value)} />
              </FormField>
              <FormField label="Monthly salary (₹)" hint="Gross">
                <Input type="number" value={form.monthlySalary} onChange={(e) => set('monthlySalary', e.target.value)} placeholder="25000" />
              </FormField>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <Pill tone="warning" size="sm">PII fields are stored as a one-way hash — only the last 4 digits are visible after save.</Pill>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Aadhaar (12 digits)" hint="Stored hashed">
                <Input value={form.aadhaar} onChange={(e) => set('aadhaar', e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="123412341234" />
              </FormField>
              <FormField label="PAN" hint="Stored hashed">
                <Input value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase().slice(0, 10))} placeholder="ABCDE1234F" />
              </FormField>
              <FormField label="Bank account number" hint="Stored hashed">
                <Input value={form.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value.replace(/\D/g, ''))} placeholder="50100123456789" />
              </FormField>
              <FormField label="IFSC">
                <Input value={form.bankIfsc} onChange={(e) => set('bankIfsc', e.target.value.toUpperCase().slice(0, 11))} placeholder="HDFC0001234" />
              </FormField>
              <FormField label="Bank name">
                <Input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="HDFC Bank" />
              </FormField>
              <FormField label="Account holder name">
                <Input value={form.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)} placeholder="As per passbook" />
              </FormField>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="text-eyebrow uppercase text-ink-muted">Residential address</div>
            <FormField label="Line 1">
              <Input value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} placeholder="Flat 12, Building B" />
            </FormField>
            <FormField label="Line 2">
              <Input value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} placeholder="Sector 5, Hadapsar" />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="City">
                <Input value={form.addressCity} onChange={(e) => set('addressCity', e.target.value)} placeholder="Pune" />
              </FormField>
              <FormField label="State">
                <Input value={form.addressState} onChange={(e) => set('addressState', e.target.value)} placeholder="Maharashtra" />
              </FormField>
              <FormField label="Pincode">
                <Input value={form.addressPincode} onChange={(e) => set('addressPincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="411028" />
              </FormField>
            </div>

            <div className="border-t border-line my-5" />

            <div className="text-eyebrow uppercase text-ink-muted">Emergency contact</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Name">
                <Input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} placeholder="Kiran Kumar" />
              </FormField>
              <FormField label="Phone">
                <Input value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} placeholder="+919800000000" />
              </FormField>
              <FormField label="Relation">
                <Input value={form.emergencyContactRelation} onChange={(e) => set('emergencyContactRelation', e.target.value)} placeholder="Spouse" />
              </FormField>
            </div>
          </div>
        ) : null}

        <div className="mt-7 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? router.back() : setStep((step - 1) as Step))}
            disabled={busy}
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </Button>
          {step < 2 ? (
            <Button onClick={next}>Next →</Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Add employee'}
            </Button>
          )}
        </div>
      </Card>
    </Shell>
  );
}
