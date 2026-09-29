export type BusinessClient = {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
