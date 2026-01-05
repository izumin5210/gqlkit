import { describe, expectTypeOf, it } from "vitest";
import type {
  DefineScalar,
  Float,
  IDNumber,
  IDString,
  Int,
  ScalarMetadataShape,
} from "./index.js";

describe("ScalarMetadataShape", () => {
  it("should have name property as string", () => {
    expectTypeOf<ScalarMetadataShape["name"]>().toEqualTypeOf<string>();
  });

  it("should have optional only property with 'input' | 'output' | undefined", () => {
    expectTypeOf<ScalarMetadataShape["only"]>().toEqualTypeOf<
      "input" | "output" | undefined
    >();
  });
});

describe("Built-in scalar types with metadata", () => {
  describe("Int", () => {
    it("should be assignable from number", () => {
      expectTypeOf<number>().toMatchTypeOf<Int>();
    });

    it("should be assignable to number", () => {
      expectTypeOf<Int>().toMatchTypeOf<number>();
    });

    it("should have $gqlkitScalar metadata with name 'Int'", () => {
      type IntMetadata = Int extends { " $gqlkitScalar"?: infer M } ? M : never;
      expectTypeOf<IntMetadata>().toEqualTypeOf<{
        name: "Int";
        only: undefined;
      }>();
    });
  });

  describe("Float", () => {
    it("should be assignable from number", () => {
      expectTypeOf<number>().toMatchTypeOf<Float>();
    });

    it("should be assignable to number", () => {
      expectTypeOf<Float>().toMatchTypeOf<number>();
    });

    it("should have $gqlkitScalar metadata with name 'Float'", () => {
      type FloatMetadata = Float extends { " $gqlkitScalar"?: infer M }
        ? M
        : never;
      expectTypeOf<FloatMetadata>().toEqualTypeOf<{
        name: "Float";
        only: undefined;
      }>();
    });
  });

  describe("IDString", () => {
    it("should be assignable from string", () => {
      expectTypeOf<string>().toMatchTypeOf<IDString>();
    });

    it("should be assignable to string", () => {
      expectTypeOf<IDString>().toMatchTypeOf<string>();
    });

    it("should have $gqlkitScalar metadata with name 'ID'", () => {
      type IDStringMetadata = IDString extends { " $gqlkitScalar"?: infer M }
        ? M
        : never;
      expectTypeOf<IDStringMetadata>().toEqualTypeOf<{
        name: "ID";
        only: undefined;
      }>();
    });
  });

  describe("IDNumber", () => {
    it("should be assignable from number", () => {
      expectTypeOf<number>().toMatchTypeOf<IDNumber>();
    });

    it("should be assignable to number", () => {
      expectTypeOf<IDNumber>().toMatchTypeOf<number>();
    });

    it("should have $gqlkitScalar metadata with name 'ID'", () => {
      type IDNumberMetadata = IDNumber extends { " $gqlkitScalar"?: infer M }
        ? M
        : never;
      expectTypeOf<IDNumberMetadata>().toEqualTypeOf<{
        name: "ID";
        only: undefined;
      }>();
    });
  });
});

describe("DefineScalar utility type", () => {
  it("should create scalar type with name metadata", () => {
    type DateTime = DefineScalar<"DateTime", Date>;
    type DateTimeMetadata = DateTime extends { " $gqlkitScalar"?: infer M }
      ? M
      : never;
    expectTypeOf<DateTimeMetadata>().toEqualTypeOf<{
      name: "DateTime";
      only: undefined;
    }>();
  });

  it("should preserve base type compatibility", () => {
    type DateTime = DefineScalar<"DateTime", Date>;
    expectTypeOf<Date>().toMatchTypeOf<DateTime>();
    expectTypeOf<DateTime>().toMatchTypeOf<Date>();
  });

  it("should support only: 'input' constraint", () => {
    type DateTimeInput = DefineScalar<"DateTime", Date, "input">;
    type DateTimeInputMetadata = DateTimeInput extends {
      " $gqlkitScalar"?: infer M;
    }
      ? M
      : never;
    expectTypeOf<DateTimeInputMetadata>().toEqualTypeOf<{
      name: "DateTime";
      only: "input";
    }>();
  });

  it("should support only: 'output' constraint", () => {
    type DateTimeOutput = DefineScalar<"DateTime", Date, "output">;
    type DateTimeOutputMetadata = DateTimeOutput extends {
      " $gqlkitScalar"?: infer M;
    }
      ? M
      : never;
    expectTypeOf<DateTimeOutputMetadata>().toEqualTypeOf<{
      name: "DateTime";
      only: "output";
    }>();
  });

  it("should work with string base type", () => {
    type URL = DefineScalar<"URL", string>;
    expectTypeOf<string>().toMatchTypeOf<URL>();
    expectTypeOf<URL>().toMatchTypeOf<string>();
  });

  it("should work with number base type", () => {
    type Timestamp = DefineScalar<"Timestamp", number>;
    expectTypeOf<number>().toMatchTypeOf<Timestamp>();
    expectTypeOf<Timestamp>().toMatchTypeOf<number>();
  });

  it("should work with union base type", () => {
    type DateTimeOutput = DefineScalar<"DateTime", Date | string, "output">;
    expectTypeOf<Date>().toMatchTypeOf<DateTimeOutput>();
    expectTypeOf<string>().toMatchTypeOf<DateTimeOutput>();
  });
});

describe("Scalar type usage patterns", () => {
  it("should allow nullable scalar types", () => {
    type NullableInt = Int | null;
    expectTypeOf<null>().toMatchTypeOf<NullableInt>();
    expectTypeOf<Int>().toMatchTypeOf<NullableInt>();
  });

  it("should allow array of scalar types", () => {
    type IntArray = Int[];
    expectTypeOf<Int[]>().toEqualTypeOf<IntArray>();
  });

  it("should allow nullable array of scalar types", () => {
    type NullableIntArray = Int[] | null;
    expectTypeOf<Int[] | null>().toEqualTypeOf<NullableIntArray>();
  });

  it("should allow array of nullable scalar types", () => {
    type ArrayOfNullableInt = (Int | null)[];
    expectTypeOf<(Int | null)[]>().toEqualTypeOf<ArrayOfNullableInt>();
  });
});
