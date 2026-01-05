type DateTime1 = number;
type DateTime2 = string;
type URLOutput = string;

export interface Event {
  id: string;
  name: string;
  createdAt: DateTime1;
  websiteUrl: URLOutput | null;
}
