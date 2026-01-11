import { flavors } from "@catppuccin/palette";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import "../styles/catppuccin-theme.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Search } from "../components/search";

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

const primaryDark = flavors.mocha.colors.red;
const primaryLight = flavors.latte.colors.red;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  console.log(JSON.stringify({ primaryDark, primaryLight }, null, 2));
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head
        color={{
          hue: {
            dark: Math.round(primaryDark.hsl.h),
            light: Math.round(primaryLight.hsl.h),
          },
          saturation: {
            dark: Math.round(primaryDark.hsl.s * 100),
            light: Math.round(primaryLight.hsl.s * 100),
          },
          lightness: {
            dark: Math.round(primaryDark.hsl.l * 100),
            light: Math.round(primaryLight.hsl.l * 100),
          },
        }}
        backgroundColor={{
          dark: flavors.mocha.colors.base.hex,
          // light: flavors.latte.colors.base.hex,
          light: "#f9fafb",
        }}
      />

      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/izumin5210/gqlkit/tree/main/packages/docs/src/content"
          editLink="Edit this page on GitHub"
          sidebar={{ autoCollapse: false, defaultMenuCollapseLevel: 1 }}
          search={<Search />}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
