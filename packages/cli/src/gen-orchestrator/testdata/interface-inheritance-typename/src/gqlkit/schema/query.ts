import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Content, Entity, Node } from "./types.js";

export const node = defineQuery<NoArgs, Node | null>(() => null);

export const entities = defineQuery<NoArgs, Entity[]>(() => []);

export const contents = defineQuery<NoArgs, Content[]>(() => []);
