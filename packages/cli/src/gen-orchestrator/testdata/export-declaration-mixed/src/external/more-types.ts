export interface Invoice {
  id: string;
  amount: number;
  dueDate: string;
}

export interface Payment {
  id: string;
  amount: number;
  paidAt: string;
}
