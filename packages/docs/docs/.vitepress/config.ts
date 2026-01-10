import { defineConfig } from "vitepress";

export default defineConfig({
  title: "gqlkit",
  description:
    "Convention-driven code generator for GraphQL servers in TypeScript",

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/types" },
    ],

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
          text: "Basics",
          items: [
            { text: "Defining Types", link: "/guide/defining-types" },
            { text: "Defining Resolvers", link: "/guide/defining-resolvers" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Type Mapping", link: "/reference/types" },
            { text: "Utility Types", link: "/reference/utility-types" },
            { text: "CLI Commands", link: "/reference/cli" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/izumin5210/gqlkit" },
    ],
  },
});
