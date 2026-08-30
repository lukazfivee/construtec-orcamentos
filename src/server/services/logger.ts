type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, string | number | boolean | undefined>;

const SENSITIVE_KEYS = new Set(['bdi', 'bdiMultiplier', 'salary', 'cost', 'margin', 'unitCost', 'snapshot_unit_cost', 'monthly_salary']);

const sanitize = (context: LogContext): LogContext => {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
};

export const logEvent = (level: LogLevel, event: string, context: LogContext = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitize(context),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};
