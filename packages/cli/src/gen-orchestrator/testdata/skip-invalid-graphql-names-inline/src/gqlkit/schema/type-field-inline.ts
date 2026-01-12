export type Article = {
  id: string;
  title: string;
  metadata: {
    author: string;
    publishedAt: string;
    "0invalid": string;
    __internal: string;
  };
};

export type ArticleInput = {
  title: string;
  metadata: {
    author: string;
    "123abc": string;
    __private: string;
  };
};
