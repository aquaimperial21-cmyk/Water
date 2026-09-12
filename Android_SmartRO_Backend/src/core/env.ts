// Boot-time environment validation.
//
// Every secret in this app used to fail open: JWT_ACCESS_SECRET fell back to the
// literal 'dev-access' and OTP_DEV_RETURN defaulted to true, so a deploy that
// forgot either came up healthy while signing forgeable tokens and echoing OTPs
// in API responses. Production now refuses to start instead.

const PLACEHOLDER_SECRETS = new Set([
  'dev-access',
  'dev-refresh',
  'change-me-access-secret',
  'change-me-refresh-secret',
]);

function problemsInProduction(): string[] {
  const problems: string[] = [];

  for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = process.env[key];
    if (!value) {
      problems.push(`${key} is not set`);
    } else if (PLACEHOLDER_SECRETS.has(value)) {
      problems.push(`${key} is still the example placeholder value`);
    }
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    problems.push(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not set — phone login cannot verify tokens'
    );
  }

  if ((process.env.OTP_DEV_RETURN ?? 'true') === 'true') {
    problems.push('OTP_DEV_RETURN must be "false" in production — it returns OTPs to callers');
  }

  if ((process.env.CORS_ORIGINS ?? '*').split(',').some((o) => o.trim() === '*')) {
    problems.push('CORS_ORIGINS must list real origins in production, not "*"');
  }

  return problems;
}

export function assertEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const problems = problemsInProduction();
  if (problems.length === 0) return;

  throw new Error(
    'Refusing to start with an unsafe configuration:\n  - ' + problems.join('\n  - ')
  );
}
