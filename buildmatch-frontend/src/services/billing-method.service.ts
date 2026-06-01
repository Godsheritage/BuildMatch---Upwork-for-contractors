import api from './api';

export type BillingMethodType = 'CARD' | 'PAYPAL' | 'VENMO';

export interface BillingMethod {
  id:           string;
  type:         BillingMethodType;
  brand:        string | null;
  last4:        string | null;
  holderName:   string | null;
  expMonth:     number | null;
  expYear:      number | null;
  accountEmail: string | null;
  country:      string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city:         string | null;
  state:        string | null;
  zipCode:      string | null;
  isDefault:    boolean;
  createdAt:    string;
}

export interface AddCardPayload {
  type:         'CARD';
  cardNumber:   string;
  holderName:   string;
  expMonth:     number;
  expYear:      number;
  country:      string;
  addressLine1: string;
  addressLine2?: string;
  city:         string;
  state:        string;
  zipCode:      string;
}
export interface AddPaypalPayload { type: 'PAYPAL'; accountEmail: string }
export interface AddVenmoPayload  { type: 'VENMO';  accountEmail: string }

export type AddBillingMethodPayload = AddCardPayload | AddPaypalPayload | AddVenmoPayload;

interface ApiResp<T> { success: boolean; data: T; message?: string }

export async function listBillingMethods(): Promise<BillingMethod[]> {
  const { data } = await api.get<ApiResp<BillingMethod[]>>('/billing-methods');
  return data.data;
}

export async function addBillingMethod(payload: AddBillingMethodPayload): Promise<BillingMethod> {
  const { data } = await api.post<ApiResp<BillingMethod>>('/billing-methods', payload);
  return data.data;
}

export async function deleteBillingMethod(id: string): Promise<void> {
  await api.delete(`/billing-methods/${id}`);
}

export async function setDefaultBillingMethod(id: string): Promise<void> {
  await api.put(`/billing-methods/${id}/default`);
}
