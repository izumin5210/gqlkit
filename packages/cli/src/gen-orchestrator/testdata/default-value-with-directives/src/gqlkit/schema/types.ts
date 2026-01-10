import {
  createGqlkitApis,
  type GqlDirective,
  type GqlField,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type LengthDirective<TArgs extends { min: number; max: number }> =
  GqlDirective<
    "length",
    TArgs,
    "INPUT_FIELD_DEFINITION" | "ARGUMENT_DEFINITION"
  >;

export type RangeDirective<TArgs extends { min: number; max: number }> =
  GqlDirective<
    "range",
    TArgs,
    "INPUT_FIELD_DEFINITION" | "ARGUMENT_DEFINITION"
  >;

export type CreateUserInput = {
  name: GqlField<
    string,
    {
      defaultValue: "Anonymous";
      directives: [LengthDirective<{ min: 1; max: 100 }>];
    }
  >;
  age: GqlField<
    Int,
    {
      defaultValue: 18;
      directives: [RangeDirective<{ min: 0; max: 150 }>];
    }
  >;
  email: GqlField<
    string | null,
    {
      defaultValue: null;
      directives: [LengthDirective<{ min: 5; max: 255 }>];
    }
  >;
};

export type User = {
  id: string;
  name: string;
  age: Int;
  email: string | null;
};

const { defineQuery, defineMutation } = createGqlkitApis();

export const user = defineQuery<NoArgs, User | null>(() => null);

export const createUser = defineMutation<CreateUserInput, User>((_, args) => ({
  id: "1",
  name: args.name,
  age: args.age,
  email: args.email ?? null,
}));
