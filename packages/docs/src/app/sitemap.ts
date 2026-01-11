import type { MetadataRoute } from "next";
import { getPageMap } from "nextra/page-map";

export const dynamic = "force-static";

const BASE_URL = "https://gqlkit.izumin.dev";

function extractRoutes(pageMap: unknown[]): string[] {
  const routes: string[] = [];
  for (const item of pageMap) {
    if (item && typeof item === "object") {
      if ("route" in item && typeof item.route === "string") {
        routes.push(item.route);
      }
      if ("children" in item && Array.isArray(item.children)) {
        routes.push(...extractRoutes(item.children));
      }
    }
  }
  return routes;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pageMap = await getPageMap();
  const routes = [...new Set(extractRoutes(pageMap))];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
