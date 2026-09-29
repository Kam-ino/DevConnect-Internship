const ID_PATTERN = /^[1-9][0-9]{0,14}$/;
export const CUSTOMER_MAX_LENGTH = 100;

const fail = (field, message) => ({ error: { field, message } });
const describe = (value) => (value === null ? 'null' : Array.isArray(value) ? 'an array' : `a ${typeof value}`);

export function parseId(raw, field) {
  if (typeof raw !== 'string' || !ID_PATTERN.test(raw)) {
    return fail(field, `${field} must be a positive integer`);
  }
  return { value: Number(raw) };
}

export function validateReservationBody(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    return fail('body', 'request body must be a JSON object; send Content-Type: application/json');
  }
  if (!Object.hasOwn(body, 'customer') || body.customer === undefined || body.customer === null) {
    return fail('customer', 'customer is required');
  }
  if (typeof body.customer !== 'string') {
    return fail('customer', `customer must be a string, got ${describe(body.customer)}`);
  }
  const customer = body.customer.trim();
  if (customer === '') {
    return fail('customer', 'customer must not be empty');
  }
  if (customer.length > CUSTOMER_MAX_LENGTH) {
    return fail('customer', `customer must be at most ${CUSTOMER_MAX_LENGTH} characters, got ${customer.length}`);
  }
  return { value: { customer } };
}
