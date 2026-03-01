import { defineSubscription } from "../gqlkit.js";

// Subscription with inline object type arguments and TSDoc on fields
export const orderUpdated = defineSubscription<
  {
    /** Filter options for order updates */
    filter: {
      /** Order status to filter by */
      status: string | null;
      /** Minimum order amount */
      minAmount: number | null;
    };
  },
  { orderId: string; status: string }
>(async function* () {
  yield { orderId: "1", status: "shipped" };
});
