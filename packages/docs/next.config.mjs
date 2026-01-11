import nextra from "nextra";

const withNextra = nextra({
  contentDirBasePath: "/",
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: {
        dark: "catppuccin-mocha",
        light: "catppuccin-latte",
      },
    },
  },
});

export default withNextra({
  output: "export",
  images: {
    unoptimized: true,
  },
});
