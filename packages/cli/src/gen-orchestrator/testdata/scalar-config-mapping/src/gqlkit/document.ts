type DateTime = string;
type JsonValue = string;

export interface Document {
  id: string;
  title: string;
  createdAt: DateTime;
  metadata: JsonValue | null;
}
