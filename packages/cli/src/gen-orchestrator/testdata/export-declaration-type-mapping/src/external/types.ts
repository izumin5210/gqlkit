/**
 * External article type demonstrating various type mappings
 */
export interface Article {
  id: string;
  title: string;
  viewCount: number;
  isPublished: boolean;
  authorId: string | null;
  tags: string[];
  ratings: number[] | null;
}

/**
 * Input type for creating articles
 */
export interface CreateArticleInput {
  title: string;
  content: string;
  tags: string[];
  isPublished: boolean | null;
}

/**
 * Union type for external search results
 */
export type SearchResult = TextResult | ImageResult;

export interface TextResult {
  id: string;
  text: string;
}

export interface ImageResult {
  id: string;
  imageUrl: string;
}

/**
 * Enum type for article status
 */
export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
