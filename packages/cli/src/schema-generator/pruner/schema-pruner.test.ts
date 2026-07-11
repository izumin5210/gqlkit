import { type DocumentNode, Kind, parse } from "graphql";
import { describe, expect, it } from "vitest";
import { pruneDocumentNode } from "./schema-pruner.js";

function doc(sdl: string): DocumentNode {
  return parse(sdl, { noLocation: true });
}

function definitionNames(documentNode: DocumentNode): string[] {
  return documentNode.definitions.flatMap((definition) =>
    "name" in definition && definition.name !== undefined
      ? [definition.name.value]
      : [],
  );
}

describe("pruneDocumentNode", () => {
  it("removes types unreachable from Query", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { user: User! }
        type User { id: ID! }
        type Orphan { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan"]);
    expect(definitionNames(result.documentNode)).toEqual(["Query", "User"]);
  });

  it("follows field, argument, input field, and union member references", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { search(filter: Filter!): Result! }
        input Filter { status: Status! }
        enum Status { ACTIVE }
        union Result = Hit | Miss
        type Hit { score: Float! }
        type Miss { reason: Reason! }
        type Reason { text: String! }
        type Orphan { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan"]);
  });

  it("unwraps list and non-null wrappers", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { items(ids: [ID!]!): [Item!]! }
        type Item { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual([]);
  });

  it("keeps implementers of a reachable interface and their references", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { node: Node }
        interface Node { id: ID! }
        type Post implements Node { id: ID! meta: PostMeta! }
        type PostMeta { tags: [String!]! }
        type Orphan { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan"]);
    expect(definitionNames(result.documentNode)).toContain("Post");
    expect(definitionNames(result.documentNode)).toContain("PostMeta");
  });

  it("keeps `implements` interface references of reachable objects", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { post: Post! }
        interface Node { id: ID! }
        type Post implements Node { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual([]);
  });

  it("keeps extensions of kept types and follows their references", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query
        type User { id: ID! }
        type Profile { bio: String }
        type Orphan { id: ID! }
        extend type Query { user: User! }
        extend type User { profile: Profile! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan"]);
    const extensions = result.documentNode.definitions.filter(
      (d) => d.kind === Kind.OBJECT_TYPE_EXTENSION,
    );
    expect(extensions).toHaveLength(2);
  });

  it("removes extensions whose target type is removed", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { ping: Boolean! }
        type Orphan { id: ID! }
        extend type Orphan { extra: OrphanExtra! }
        type OrphanExtra { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan", "OrphanExtra"]);
    expect(
      result.documentNode.definitions.some(
        (d) => d.kind === Kind.OBJECT_TYPE_EXTENSION,
      ),
    ).toBe(false);
  });

  it("keeps directive definitions and types reachable only through them", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { ping: Boolean! }
        directive @access(role: Role!) on FIELD_DEFINITION
        enum Role { ADMIN USER }
        type Orphan { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan"]);
    expect(definitionNames(result.documentNode)).toContain("access");
    expect(definitionNames(result.documentNode)).toContain("Role");
  });

  it("treats Mutation and Subscription as roots", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query
        type Mutation { create(input: CreateInput!): Created! }
        type Subscription { changed: Change! }
        input CreateInput { name: String! }
        type Created { id: ID! }
        type Change { id: ID! }
        type Orphan { id: ID! }
      `),
    );

    expect(result.removedTypes).toEqual(["Orphan"]);
  });

  it("keeps empty root operation types", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query
        type Mutation { ping: Boolean! }
      `),
    );

    expect(result.removedTypes).toEqual([]);
    expect(definitionNames(result.documentNode)).toContain("Query");
  });

  it("is a no-op for documents without a root operation type", () => {
    const documentNode = doc(`
      type User { id: ID! }
      type Post { title: String! }
    `);
    const result = pruneDocumentNode(documentNode);

    expect(result.removedTypes).toEqual([]);
    expect(result.documentNode).toBe(documentNode);
  });

  it("returns the input document unchanged when everything is reachable", () => {
    const documentNode = doc(`
      type Query { user: User! }
      type User { id: ID! }
    `);
    const result = pruneDocumentNode(documentNode);

    expect(result.documentNode).toBe(documentNode);
  });

  it("returns removed type names sorted", () => {
    const result = pruneDocumentNode(
      doc(`
        type Query { ping: Boolean! }
        type Zebra { id: ID! }
        input Alpha { id: ID! }
        enum Mid { A }
      `),
    );

    expect(result.removedTypes).toEqual(["Alpha", "Mid", "Zebra"]);
  });
});
