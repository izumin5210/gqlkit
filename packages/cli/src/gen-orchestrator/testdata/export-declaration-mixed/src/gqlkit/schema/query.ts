import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Address, Client, Invoice, Payment } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const clients = defineQuery<NoArgs, Client[]>(() => []);

export const addresses = defineQuery<NoArgs, Address[]>(() => []);

export const invoices = defineQuery<NoArgs, Invoice[]>(() => []);

export const payments = defineQuery<NoArgs, Payment[]>(() => []);
