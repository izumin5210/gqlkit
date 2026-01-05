type DateTimeOutputNumber = number;
type DateTimeOutputString = string;

export interface Event {
  id: string;
  name: string;
  createdAt: DateTimeOutputNumber;
  updatedAt: DateTimeOutputString;
}

export interface CreateEventInput {
  name: string;
}
