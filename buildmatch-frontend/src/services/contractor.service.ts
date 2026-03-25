import api from './api';
import type { Contractor } from '../types/contractor.types';

export async function getContractors(): Promise<Contractor[]> {
  const { data } = await api.get<Contractor[]>('/contractors');
  return data;
}

export async function getContractorById(id: string): Promise<Contractor> {
  const { data } = await api.get<Contractor>(`/contractors/${id}`);
  return data;
}
