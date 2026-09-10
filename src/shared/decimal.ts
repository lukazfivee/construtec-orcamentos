// Aritmética decimal racional; só converte para number depois de arredondar.
type DecimalInput = number | string;
type Fraction = { numerator: bigint; denominator: bigint };

const fraction = (value: DecimalInput): Fraction => {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error('FINANCIAL_VALUE_INVALID');
  const scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
  if (Math.abs(scale) > 100) throw new Error('FINANCIAL_VALUE_INVALID');
  const numerator = BigInt(match[2] + (match[3] ?? '')) * (match[1] ? -1n : 1n);
  return scale >= 0
    ? { numerator, denominator: 10n ** BigInt(scale) }
    : { numerator: numerator * 10n ** BigInt(-scale), denominator: 1n };
};

const rounded = ({ numerator, denominator }: Fraction, decimals: number) => {
  if (denominator === 0n) throw new Error('FINANCIAL_VALUE_INVALID');
  const factor = 10n ** BigInt(decimals);
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absolute = (numerator < 0n ? -numerator : numerator) * factor;
  const divisor = denominator < 0n ? -denominator : denominator;
  const units = absolute / divisor + (absolute % divisor * 2n >= divisor ? 1n : 0n);
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('FINANCIAL_TOTAL_TOO_LARGE');
  return Number(negative ? -units : units) / Number(factor);
};

export const roundDecimal = (value: DecimalInput, decimals = 2) => rounded(fraction(value), decimals);

export const sumDecimal = (values: DecimalInput[], decimals = 2) => rounded(values.reduce<Fraction>(
  (sum, value) => {
    const next = fraction(value);
    const denominator = sum.denominator > next.denominator ? sum.denominator : next.denominator;
    return { numerator: sum.numerator * (denominator / sum.denominator)
      + next.numerator * (denominator / next.denominator), denominator };
  }, { numerator: 0n, denominator: 1n },
), decimals);

export const multiplyDecimal = (values: DecimalInput[], divisor: DecimalInput = 1, decimals = 2) => {
  const product = values.map(fraction).reduce<Fraction>(
    (total, value) => ({ numerator: total.numerator * value.numerator,
      denominator: total.denominator * value.denominator }),
    { numerator: 1n, denominator: 1n },
  );
  const divisorFraction = fraction(divisor);
  return rounded({ numerator: product.numerator * divisorFraction.denominator,
    denominator: product.denominator * divisorFraction.numerator }, decimals);
};
