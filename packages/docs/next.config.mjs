import nextra from "nextra";

// Pages come from @gqlkit-ts/docs-content and are compiled in
// src/app/[[...mdxPath]]/page.tsx, so there is no content directory to
// configure here.
const withNextra = nextra({});

export default withNextra({
  output: "export",
  images: {
    unoptimized: true,
  },
  // @gqlkit-ts/docs-content ships TypeScript source.
  transpilePackages: ["@gqlkit-ts/docs-content"],
});
