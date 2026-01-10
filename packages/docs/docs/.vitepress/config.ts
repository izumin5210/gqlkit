import { defineConfig } from "vitepress";

export default defineConfig({
  title: "gqlkit",
  description:
    "Convention-driven code generator for GraphQL servers in TypeScript",
  base: "/",

  markdown: {
    theme: {
      light: "catppuccin-latte",
      dark: "catppuccin-mocha",
    },
  },

  themeConfig: {
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
  },
});
