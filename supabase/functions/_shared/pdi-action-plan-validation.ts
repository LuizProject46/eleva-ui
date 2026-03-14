/**
 * Shared validation for PDI Action Plans.
 * Use this in any Edge Function that creates or updates pdi_action_plans.
 *
 * Rule: delivery_date must be >= current date (UTC).
 */

export const DELIVERY_DATE_PAST_ERROR_MESSAGE =
  'A data de entrega não pode ser no passado.';

/**
 * Returns today's date in YYYY-MM-DD (UTC).
 */
function getTodayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns true if delivery_date is today or in the future (UTC).
 */
export function isDeliveryDateValid(deliveryDate: string | null | undefined): boolean {
  const trimmed = deliveryDate?.trim();
  if (!trimmed) return false;
  return trimmed >= getTodayUtcIso();
}

/**
 * Throws if delivery_date is in the past. Use before inserting/updating pdi_action_plans.
 */
export function assertDeliveryDateNotPast(deliveryDate: string | null | undefined): void {
  if (!isDeliveryDateValid(deliveryDate)) {
    throw new Error(DELIVERY_DATE_PAST_ERROR_MESSAGE);
  }
}
