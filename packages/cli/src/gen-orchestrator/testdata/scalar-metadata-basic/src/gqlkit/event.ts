type DateTime = string;
type URL = string;

export interface Event {
  id: string;
  name: string;
  attendeeCount: number;
  startTime: DateTime;
  endTime: DateTime | null;
  websiteUrl: URL | null;
}
