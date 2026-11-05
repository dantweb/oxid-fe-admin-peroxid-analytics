import { atom, Matrix, Vector } from '../atomizer/model';

/**
 * The two models of `dantweb/ecwatch-core` the plugin reads, as that project's YAML declares them
 * (`extensions/default_plugin/EcwModels/base_order_model.yaml`, `tests/_data/.../CustomerModel.yaml`).
 * Any source — the demo generator today, the shop's GraphQL tomorrow — hands over rows of this shape.
 */
export interface BaseOrderModel {
  order_number: string;
  order_brutto: number;
  order_items_count: number;
  order_payment_method_id: string;
  timestamp: Date;
}

export interface CustomerModel {
  customer_id: number;
  first_name: string;
  last_name: string;
  email: string;
  joined_date: Date;
}

export function orderVector(order: BaseOrderModel): Vector {
  return new Vector()
    .add(atom('order_number', 'string', order.order_number))
    .add(atom('order_brutto', 'float', order.order_brutto))
    .add(atom('order_items_count', 'int', order.order_items_count))
    .add(atom('order_payment_method_id', 'string', order.order_payment_method_id))
    .add(atom('timestamp', 'timestamp', order.timestamp));
}

export function customerVector(customer: CustomerModel): Vector {
  return new Vector()
    .add(atom('customer_id', 'int', customer.customer_id))
    .add(atom('first_name', 'string', customer.first_name))
    .add(atom('last_name', 'string', customer.last_name))
    .add(atom('email', 'string', customer.email))
    .add(atom('joined_date', 'timestamp', customer.joined_date));
}

/** What the analytics read: orders and customers, as matrices of atoms. */
export interface AnalyticsData {
  orders: Matrix;
  customers: Matrix;
}

export function toAnalyticsData(
  orders: BaseOrderModel[],
  customers: CustomerModel[],
): AnalyticsData {
  return {
    orders: new Matrix(orders.map(orderVector)),
    customers: new Matrix(customers.map(customerVector)),
  };
}
