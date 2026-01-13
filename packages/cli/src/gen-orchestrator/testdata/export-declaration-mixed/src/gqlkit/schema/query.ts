import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Address, Client, Invoice, Payment } from "./types.js";

export const clients = defineQuery<NoArgs, Client[]>(() => []);

export const addresses = defineQuery<NoArgs, Address[]>(() => []);

export const invoices = defineQuery<NoArgs, Invoice[]>(() => []);

export const payments = defineQuery<NoArgs, Payment[]>(() => []);
