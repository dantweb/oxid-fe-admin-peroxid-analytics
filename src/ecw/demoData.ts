import { createRandom } from './random';
import {
  toAnalyticsData,
  type AnalyticsData,
  type BaseOrderModel,
  type CustomerModel,
} from './models';

/**
 * A port of ecwatch-core's `tests/Helper/demoda_data_generator.php`: the daily order count follows anchor
 * points by linear interpolation plus noise, the basket value drifts from 50 to 200, each order gets a
 * random time of day, item count and payment method. On top of it, new customers join every day in
 * proportion to the orders. Deterministic for a seed; no shop and no backend are involved.
 */
export interface DemoOptions {
  /** the last day of the data set (default: now) */
  today?: Date;
  /** how many days back the data reaches (default 182, about six months) */
  days?: number;
  seed?: number;
}

/** The payment method ids of a PEROXID shop. */
export const PAYMENT_METHODS = ['stripe', 'mollie', 'paypal', 'invoice'] as const;

const FIRST_NAMES = [
  'Ada',
  'Grace',
  'Linus',
  'Marie',
  'Nikola',
  'Rosalind',
  'Tim',
  'Yoko',
] as const;
const LAST_NAMES = [
  'Baker',
  'Fischer',
  'Hopper',
  'Lovelace',
  'Nguyen',
  'Okafor',
  'Silva',
  'Weber',
] as const;

const DEFAULT_DAYS = 182;
const DEFAULT_SEED = 20260101;

/** Linear interpolation between (x, y) anchors, flat beyond the first and the last one. */
export function interpolate(x: number, anchors: readonly (readonly [number, number])[]): number {
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (x <= first[0]) {
    return first[1];
  }
  if (x >= last[0]) {
    return last[1];
  }
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [x0, y0] = anchors[i]!;
    const [x1, y1] = anchors[i + 1]!;
    if (x >= x0 && x <= x1) {
      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  return first[1];
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function generateDemoData({
  today = new Date(),
  days = DEFAULT_DAYS,
  seed = DEFAULT_SEED,
}: DemoOptions = {}): AnalyticsData {
  const random = createRandom(seed);
  const span = Math.max(2, days);
  // the PHP generator's anchors (2 → 42 → 17 orders a day) laid over the chosen span
  const anchors = [
    [0, 2],
    [Math.round(span * 0.6), 42],
    [span - 1, 17],
  ] as const;
  const start = addDays(startOfDay(today), -(span - 1));
  const orders: BaseOrderModel[] = [];
  const customers: CustomerModel[] = [];

  for (let day = 0; day < span; day += 1) {
    const date = addDays(start, day);
    const count = Math.max(4, Math.floor(interpolate(day, anchors) + random.float(-10, 10)));
    const basketMean = 50 + (day / (span - 1)) * 150;
    for (let j = 0; j < count; j += 1) {
      const number = orders.length + 1;
      orders.push({
        order_number: `ORD-${String(number).padStart(5, '0')}`,
        order_items_count: random.int(1, 10),
        order_brutto: Math.round(random.float(basketMean * 0.8, basketMean * 1.2) * 100) / 100,
        order_payment_method_id: random.pick(PAYMENT_METHODS),
        timestamp: new Date(date.getTime() + random.int(0, 86399) * 1000),
      });
    }
    const joined = Math.max(1, Math.round(count * random.float(0.25, 0.45)));
    for (let j = 0; j < joined; j += 1) {
      const id = customers.length + 1;
      customers.push({
        customer_id: id,
        first_name: random.pick(FIRST_NAMES),
        last_name: random.pick(LAST_NAMES),
        email: `customer-${id}@example.invalid`,
        joined_date: new Date(date.getTime() + random.int(0, 86399) * 1000),
      });
    }
  }
  return toAnalyticsData(orders, customers);
}
