import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { compileMdx } from "nextra/compile";
import { evaluate } from "nextra/evaluate";
import { cache } from "react";
import { IndexCards } from "../../components/index-cards";
import { contentDir, getContent } from "../../lib/content";
import { useMDXComponents } from "../../mdx-components";

type PageProps = {
  params: Promise<{
    mdxPath?: string[];
  }>;
};

export async function generateStaticParams() {
  const { mdxPages } = await getContent();
  return Object.keys(mdxPages).map((route) => ({
    mdxPath: route === "" ? [] : route.split("/"),
  }));
}

// Deduplicates the compilation shared by generateMetadata() and Page().
const loadPage = cache(async (route: string) => {
  const { mdxPages } = await getContent();
  const filePath = mdxPages[route];
  if (filePath === undefined) {
    notFound();
  }
  const source = await fs.readFile(path.join(contentDir, filePath), "utf8");
  const rawJs = await compileMdx(source, {
    filePath,
    mdxOptions: {
      // Compile `.md` pages as Markdown, as the content-directory loader does.
      format: "detect",
      rehypePrettyCodeOptions: {
        theme: {
          dark: "catppuccin-mocha",
          light: "catppuccin-latte",
        },
      },
    },
  });
  // oxlint-disable-next-line typescript/unbound-method -- nextra types `wrapper` as a method, but it is a component that never uses `this`
  const { wrapper: Wrapper, ...components } = useMDXComponents({ IndexCards });
  return { rawJs, Wrapper, ...evaluate(rawJs, components) };
});

function routeOf(mdxPath: string[] | undefined): string {
  return mdxPath?.join("/") ?? "";
}

export async function generateMetadata(props: PageProps) {
  const { metadata } = await loadPage(routeOf((await props.params).mdxPath));
  return metadata;
}

export default async function Page(props: PageProps) {
  const {
    rawJs,
    Wrapper,
    default: MDXContent,
    toc,
    metadata,
  } = await loadPage(routeOf((await props.params).mdxPath));
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={rawJs}>
      <MDXContent />
    </Wrapper>
  );
}
