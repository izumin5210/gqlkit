import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "gqlkit",
    template: "%s – gqlkit",
  },
  description:
    "Convention-driven code generator for GraphQL servers in TypeScript",
};

const navbar = (
  <Navbar
    logo={<b>gqlkit</b>}
    projectLink="https://github.com/izumin5210/gqlkit"
  />
);

const footer = (
  <Footer>
    MIT {new Date().getFullYear()} © izumin5210
  </Footer>
);

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/izumin5210/gqlkit/tree/main/packages/docs"
          footer={footer}
          editLink="Edit this page on GitHub"
          sidebar={{ autoCollapse: false, defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
