import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE_URL = "https://gqlkit.izumin.dev";

const pages = [
  "",
  "/what-is-gqlkit",
  "/getting-started",
  "/schema",
  "/schema/objects",
  "/schema/inputs",
  "/schema/queries-mutations",
  "/schema/fields",
  "/schema/scalars",
  "/schema/enums",
  "/schema/unions",
  "/schema/interfaces",
  "/schema/documentation",
  "/schema/directives",
  "/integration/yoga",
  "/integration/apollo",
  "/configuration",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((page) => ({
    url: `${BASE_URL}${page}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: page === "" ? 1 : 0.8,
  }));
}
