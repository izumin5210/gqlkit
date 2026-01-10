import { defineConfig } from "vitepress";

export default defineConfig({
  title: "gqlkit",
  description:
    "Convention-driven code generator for GraphQL servers in TypeScript",
  base: "/",

  sitemap: {
    hostname: "https://gqlkit.izumin.dev",
  },

  lastUpdated: true,

  markdown: {
    theme: {
      light: "catppuccin-latte",
      dark: "catppuccin-mocha",
    },
  },

  themeConfig: {
    search:
      process.env.ALGOLIA_APP_ID &&
      process.env.ALGOLIA_API_KEY &&
      process.env.ALGOLIA_INDEX_NAME
        ? {
            provider: "algolia",
            options: {
              appId: process.env.ALGOLIA_APP_ID,
              apiKey: process.env.ALGOLIA_API_KEY,
              indexName: process.env.ALGOLIA_INDEX_NAME,
            },
          }
        : undefined,

    nav: [{ text: "Guide", link: "/guide/getting-started" }],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is gqlkit?", link: "/guide/what-is-gqlkit" },
            { text: "Getting Started", link: "/guide/getting-started" },
          ],
        },
        {
          text: "Schema",
          link: "/guide/schema/",
          items: [
            {
              text: "Core",
              items: [
                { text: "Object Types", link: "/guide/schema/objects" },
                { text: "Input Types", link: "/guide/schema/inputs" },
                {
                  text: "Queries & Mutations",
                  link: "/guide/schema/queries-mutations",
                },
                { text: "Field Resolvers", link: "/guide/schema/fields" },
              ],
            },
            {
              text: "More Types",
              items: [
                { text: "Scalars", link: "/guide/schema/scalars" },
                { text: "Enums", link: "/guide/schema/enums" },
                { text: "Unions", link: "/guide/schema/unions" },
                { text: "Interfaces", link: "/guide/schema/interfaces" },
              ],
            },
            {
              text: "Features",
              items: [
                { text: "Documentation", link: "/guide/schema/documentation" },
                { text: "Directives", link: "/guide/schema/directives" },
              ],
            },
          ],
        },
        {
          text: "Integration",
          items: [
            {
              text: "HTTP Servers",
              items: [
                { text: "graphql-yoga", link: "/guide/integration/yoga" },
                { text: "Apollo Server", link: "/guide/integration/apollo" },
              ],
            },
          ],
        },
        {
          text: "Configuration",
          link: "/guide/configuration",
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/izumin5210/gqlkit" },
    ],

    editLink: {
      pattern:
        "https://github.com/izumin5210/gqlkit/edit/main/packages/docs/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message:
        'Released under the <a href="https://github.com/izumin5210/gqlkit/blob/main/LICENSE">MIT License</a>.',
      copyright: "Copyright © 2025-present izumin5210",
    },

    externalLinkIcon: true,
  },
});
