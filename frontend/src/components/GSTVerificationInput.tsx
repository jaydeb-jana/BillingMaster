import { useState, useMemo } from 'react';
import {
  CheckCircle2, ShieldCheck, ShieldAlert,
  ExternalLink, Sparkles, Building2, MapPin, CreditCard, RefreshCw, X
} from 'lucide-react';
import { verifyGSTIN, type GSTVerificationResult } from '@/lib/gst';

interface GSTVerificationInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerified?: (isValid: boolean, result?: GSTVerificationResult) => void;
  className?: string;
}

export function GSTVerificationInput({
  value,
  onChange,
  onVerified,
  className = '',
}: GSTVerificationInputProps) {
  const [verifying, setVerifying] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const verification: GSTVerificationResult = useMemo(() => {
    return verifyGSTIN(value);
  }, [value]);

  const handleInputChange = (rawVal: string) => {
    const formatted = rawVal.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    onChange(formatted);
    if (hasChecked) {
      setHasChecked(false);
      onVerified?.(false);
    }
  };

  const runVerification = () => {
    if (!value || value.length < 15) return;
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setHasChecked(true);
      setShowDetails(true);
      const res = verifyGSTIN(value);
      onVerified?.(res.isValid, res);
    }, 350);
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="container-gst-verification">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <label className="block text-xs font-bold text-foreground">
          GSTIN / GST Number
          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(Goods & Services Tax ID)</span>
        </label>
        <span className="text-[10px] text-muted-foreground">
          15-character Indian Tax Identifier
        </span>
      </div>

      {/* Main GST Input with Right-Side Verify Button */}
      <div
        className={`input-shell flex items-center p-1 pl-3 gap-2 transition-all ${
          hasChecked && verification.isValid
            ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20'
            : hasChecked && !verification.isValid && value
            ? 'border-destructive bg-destructive/5 ring-2 ring-destructive/20'
            : 'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
        }`}
      >
        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
          GST
        </span>

        <input
          type="text"
          value={value || ''}
          maxLength={15}
          placeholder="ENTER 15-DIGIT GSTIN"
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runVerification();
            }
          }}
          className="flex-1 min-w-0 bg-transparent py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/60 placeholder:font-normal focus:outline-none"
          data-testid="input-gstin-number"
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setHasChecked(false);
              onVerified?.(false);
            }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Clear input"
          >
            <X size={14} />
          </button>
        )}

        {/* Right-aligned Verify Button */}
        <button
          type="button"
          disabled={!value || value.length < 15 || verifying}
          onClick={runVerification}
          className={`shrink-0 flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            hasChecked && verification.isValid
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : hasChecked && !verification.isValid
              ? 'bg-destructive/90 hover:bg-destructive text-white'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
          data-testid="button-verify-gstin"
        >
          {verifying ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span className="hidden xs:inline sm:inline">Verifying…</span>
            </>
          ) : hasChecked && verification.isValid ? (
            <>
              <CheckCircle2 size={14} className="text-white" />
              <span>Verified</span>
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              <span>Verify</span>
            </>
          )}
        </button>
      </div>

      {/* Detailed Verification Feedback Card */}
      {hasChecked && value && (
        <div
          className={`rounded-2xl border p-4 transition-all animate-rise ${
            verification.isValid
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-50'
              : 'border-destructive/30 bg-destructive/5 text-destructive-foreground'
          }`}
          data-testid="gst-verification-result"
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-current/10">
            <div className="flex items-center gap-2">
              {verification.isValid ? (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-white shadow-xs shrink-0">
                  <ShieldCheck size={16} />
                </div>
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-destructive text-white shadow-xs shrink-0">
                  <ShieldAlert size={16} />
                </div>
              )}
              <div>
                <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                  {verification.isValid ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      ✓ Real & Genuine GSTIN Verified
                    </span>
                  ) : (
                    <span className="text-destructive">
                      ✕ Invalid / Fake GST Number
                    </span>
                  )}
                </h4>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {verification.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[10px] font-bold underline opacity-80 hover:opacity-100 shrink-0"
            >
              {showDetails ? 'Hide details' : 'View details'}
            </button>
          </div>

          {/* Breakdown parameters */}
          {showDetails && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              {/* 1. STATE / JURISDICTION */}
              <div className="rounded-xl border border-current/10 bg-background/60 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <MapPin size={12} className="text-primary" /> State / Jurisdiction
                </div>
                <div className="font-bold text-foreground">
                  {verification.stateName || 'Invalid Code'}
                  {verification.stateCode ? ` (Code: ${verification.stateCode})` : ''}
                </div>
              </div>

              {/* 2. PERMANENT ACCOUNT NO. (PAN) */}
              <div className="rounded-xl border border-current/10 bg-background/60 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <CreditCard size={12} className="text-primary" /> Permanent Account No. (PAN)
                </div>
                <div className="font-bold text-foreground mono">
                  {verification.pan || '—'}
                </div>
              </div>

              {/* 3. ENTITY CLASSIFICATION */}
              <div className="rounded-xl border border-current/10 bg-background/60 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <Building2 size={12} className="text-primary" /> Entity Classification
                </div>
                <div className="font-bold text-foreground">
                  {verification.entityType || '—'}
                </div>
              </div>

              {/* 4. CHECKSUM ALGORITHM */}
              <div className="rounded-xl border border-current/10 bg-background/60 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <Sparkles size={12} className="text-primary" /> Checksum Algorithm (Luhn Mod-36)
                </div>
                <div className={`font-bold ${verification.isChecksumValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {verification.isChecksumValid
                    ? `Passed (Check Digit: ${verification.checksumChar})`
                    : `Failed (Got: '${verification.checksumChar}', Expected: '${verification.expectedChecksumChar}')`}
                </div>
              </div>
            </div>
          )}

          {/* Errors list if invalid */}
          {!verification.isValid && verification.errors.length > 0 && (
            <div className="mt-3 rounded-xl bg-destructive/10 p-2.5 text-[11px] space-y-1 text-destructive font-medium">
              <div className="font-bold">Detected Issues:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {verification.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* External Govt Portal link */}
          <div className="mt-3 pt-2.5 border-t border-current/10 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] opacity-75">
              Cross-verify official records on Government of India GST Portal:
            </span>
            <a
              href="https://services.gst.gov.in/services/searchtp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              <span>Search on GST.gov.in</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
