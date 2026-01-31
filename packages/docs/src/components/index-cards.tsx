import { Cards } from "nextra/components";

type Props = {
  items: {
    title: string;
    description: string;
    href: string;
  }[];
};

export function IndexCards({ items }: Props) {
  return (
    <Cards>
      {items.map((item) => (
        <Cards.Card
          arrow
          key={item.href}
          // @ts-expect-error Cards.Card title can be a ReactNode
          title={
            <>
              {item.title}
              <br />
              <small style={{ fontWeight: "normal", fontSize: "90%" }}>
                {item.description}
              </small>
            </>
          }
          href={item.href}
        />
      ))}
    </Cards>
  );
}
