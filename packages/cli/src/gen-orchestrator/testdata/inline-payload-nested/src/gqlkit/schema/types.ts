import {
  defineField,
  defineIsTypeOf,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

/**
 * Mutation returning nested inline objects (tests 5.1, 5.4)
 * Creates: CreateOrderPayload, CreateOrderPayloadOrder, CreateOrderPayloadOrderShipping
 */
export const createOrder = defineMutation<
  { productId: string },
  {
    /** Order details */
    order: {
      /** Order ID */
      id: string;
      /** Order status */
      status: string;
      /** Shipping information */
      shipping: {
        /** Tracking number */
        trackingNumber: string;
        /** Estimated delivery */
        estimatedDays: number;
      };
    };
    success: boolean;
  }
>((_root, _args) => ({
  order: {
    id: "order-1",
    status: "pending",
    shipping: {
      trackingNumber: "TRACK-123",
      estimatedDays: 5,
    },
  },
  success: true,
}));

/**
 * Query with deeply nested inline objects (3+ levels, tests 5.4)
 * Creates: GetCompanyPayload, GetCompanyPayloadCompany, GetCompanyPayloadCompanyHeadquarters, GetCompanyPayloadCompanyHeadquartersAddress
 */
export const getCompany = defineQuery<
  { id: string },
  {
    company: {
      name: string;
      headquarters: {
        name: string;
        address: {
          street: string;
          city: string;
          country: string;
        };
      };
    };
  }
>((_root, _args) => ({
  company: {
    name: "Acme Corp",
    headquarters: {
      name: "Main HQ",
      address: {
        street: "123 Main St",
        city: "San Francisco",
        country: "USA",
      },
    },
  },
}));

/**
 * Mutation with nested inline enum (tests 5.2)
 * Creates: UpdateStatusPayload, UpdateStatusPayloadResult (Enum)
 */
export const updateStatus = defineMutation<
  { id: string },
  {
    previousStatus: string;
    result: "pending" | "processing" | "completed" | "failed";
  }
>((_root, _args) => ({
  previousStatus: "pending",
  result: "processing",
}));

/**
 * Field resolver with nested inline objects (tests 5.1 for field resolver)
 * Creates: UserProfilePayload, UserProfilePayloadStats
 */
export const profile = defineField<
  User,
  Record<string, never>,
  {
    bio: string | null;
    stats: {
      postsCount: number;
      followersCount: number;
    };
  }
>((_parent, _args) => ({
  bio: null,
  stats: {
    postsCount: 10,
    followersCount: 100,
  },
}));

/**
 * Mutation with inline enum inside nested inline object
 * Creates: SubmitFormPayload, SubmitFormPayloadValidation, SubmitFormPayloadValidationStatus (Enum)
 */
export const submitForm = defineMutation<
  { data: string },
  {
    validation: {
      isValid: boolean;
      status: "valid" | "invalid" | "partial";
    };
  }
>((_root, _args) => ({
  validation: {
    isValid: true,
    status: "valid",
  },
}));

/**
 * Union member types for nested union test (tests 5.3)
 */
export type OperationSuccess = {
  message: string;
  timestamp: string;
};

export type OperationPending = {
  message: string;
  estimatedCompletion: string;
};

export type OperationFailed = {
  errorCode: string;
  errorMessage: string;
};

export const operationSuccessIsTypeOf = defineIsTypeOf<OperationSuccess>(
  (value) => typeof value === "object" && value !== null && "timestamp" in value,
);

export const operationPendingIsTypeOf = defineIsTypeOf<OperationPending>(
  (value) =>
    typeof value === "object" && value !== null && "estimatedCompletion" in value,
);

export const operationFailedIsTypeOf = defineIsTypeOf<OperationFailed>(
  (value) => typeof value === "object" && value !== null && "errorCode" in value,
);

/**
 * Mutation with nested inline union (tests 5.3)
 * Creates: ProcessDataPayload (Object), ProcessDataPayloadResult (Union)
 */
export const processData = defineMutation<
  { data: string },
  {
    processingId: string;
    result: OperationSuccess | OperationPending | OperationFailed;
  }
>((_root, _args) => ({
  processingId: "proc-1",
  result: {
    message: "Success",
    timestamp: "2025-01-01",
  },
}));

/**
 * Query with deeply nested inline union inside nested object (tests 5.3, 5.4)
 * Creates: GetTaskResultPayload, GetTaskResultPayloadTask, GetTaskResultPayloadTaskOutcome (Union)
 */
export const getTaskResult = defineQuery<
  { taskId: string },
  {
    task: {
      id: string;
      name: string;
      outcome: OperationSuccess | OperationFailed;
    };
  }
>((_root, _args) => ({
  task: {
    id: "task-1",
    name: "Test Task",
    outcome: {
      message: "Task completed",
      timestamp: "2025-01-01",
    },
  },
}));

/**
 * Field resolver with nested union (tests 5.3 for field resolver)
 * Creates: UserLatestActionPayload (Object), UserLatestActionPayloadAction (Union)
 */
export const latestAction = defineField<
  User,
  NoArgs,
  {
    timestamp: string;
    action: OperationSuccess | OperationPending;
  }
>((_parent, _args) => ({
  timestamp: "2025-01-01",
  action: {
    message: "Action completed",
    timestamp: "2025-01-01",
  },
}));
