export function filterProductsThroughDate<T extends { stop_time: string }>(
  products: readonly T[],
  date: string
): T[] {
  const cutoff = Date.parse(`${date}T23:59:59.999Z`);
  if (!Number.isFinite(cutoff)) return [];
  return products.filter((product) => {
    const acquiredAt = Date.parse(product.stop_time);
    return Number.isFinite(acquiredAt) && acquiredAt <= cutoff;
  });
}
