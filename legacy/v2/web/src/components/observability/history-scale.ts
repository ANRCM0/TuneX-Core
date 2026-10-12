import { validHistoryDecimal } from "@/lib/api/observability-history-contract";

/** Only the bounded final percentage becomes Number; original decimal counters stay exact. */
export function historyHeights(values: (string | null)[]): (number | null)[] {
  const fractions = values.map((value) => {
    if (value === null || !validHistoryDecimal(value)) return null;
    const [decimal, exp = "0"] = value.toLowerCase().split("e"), [whole, part = ""] = decimal.split(".");
    const exponent = Number(exp) - part.length;
    return { n: BigInt(whole + part) * (exponent > 0 ? 10n ** BigInt(exponent) : 1n), d: exponent < 0 ? 10n ** BigInt(-exponent) : 1n };
  });
  const max = fractions.reduce<{ n: bigint; d: bigint }>((max, f) => f && f.n * max.d > max.n * f.d ? f : max, { n: 0n, d: 1n });
  return fractions.map((f) => f === null ? null : max.n === 0n ? 0 : Number(f.n * max.d * 10000n / (f.d * max.n)) / 100);
}
