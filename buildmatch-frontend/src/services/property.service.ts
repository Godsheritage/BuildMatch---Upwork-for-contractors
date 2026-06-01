import api from './api';

interface R<T> { success: boolean; data: T; message?: string }
function d<T>(res: { data: R<T> }): T { return res.data.data; }

// ── Types ────────────────────────────────────────────────────────────────────

export type PropertyType =
  | 'SINGLE_FAMILY' | 'DUPLEX' | 'TRIPLEX' | 'FOURPLEX'
  | 'TOWNHOUSE' | 'CONDO' | 'MULTI_FAMILY' | 'COMMERCIAL';

export type RenovationPurpose = 'FLIP' | 'RENTAL' | 'PRIMARY_RESIDENCE' | 'WHOLESALE';
export type PrimaryIssue = 'COSMETIC' | 'FULL_GUT' | 'WATER_DAMAGE' | 'FIRE_DAMAGE' | 'NEGLECT' | 'STRUCTURAL' | 'PARTIAL';
export type EstimateStatus = 'PROCESSING' | 'COMPLETE' | 'FAILED';

export interface Property {
  id: string; investor_id: string; address_line1: string; address_line2: string | null;
  city: string; state: string; zip_code: string; property_type: PropertyType;
  year_built: number | null; sqft_estimate: number | null;
  bedrooms: number | null; bathrooms: number | null;
  has_basement: boolean; has_garage: boolean; stories: number;
  created_at: string; updated_at: string;
}

export interface LineItem {
  category: string; description: string; low: number; high: number;
  unit?: string; quantity?: number;
}
export interface RoomBreakdown {
  room: string; items: LineItem[]; low: number; high: number;
}

export interface PropertyEstimate {
  id: string; property_id: string; investor_id: string; status: EstimateStatus;
  renovation_purpose: RenovationPurpose; primary_issue: PrimaryIssue;
  total_low: number | null; total_high: number | null;
  confidence_overall: string | null;
  line_items: LineItem[] | null; room_breakdown: RoomBreakdown[] | null;
  ai_summary: string | null; ai_rationale: string | null;
  cannot_assess: string[] | null; ai_model: string | null;
  photo_count: number; processing_started: string | null; processing_finished: string | null;
  created_at: string;
}

export interface EstimatePhoto {
  id: string; estimate_id: string; property_id: string;
  area_key: string; area_label: string; url: string; storage_path: string;
  caption: string | null; sort_order: number; created_at: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const listProperties     = ()                    => api.get('/properties').then(d<Property[]>);
export const getProperty        = (id: string)          => api.get(`/properties/${id}`).then(d<Property>);
export const createProperty     = (input: Partial<Property>) => api.post('/properties', input).then(d<Property>);
export const deleteProperty     = (id: string)          => api.delete(`/properties/${id}`);

export const listEstimates      = (propertyId: string)  => api.get(`/properties/${propertyId}/estimates`).then(d<PropertyEstimate[]>);
export const getEstimate        = (id: string)          => api.get(`/properties/estimates/${id}`).then(d<PropertyEstimate>);
export const createEstimate     = (input: { property_id: string; renovation_purpose: string; primary_issue: string }) =>
  api.post('/properties/estimates', input).then(d<PropertyEstimate>);
export const runEstimation      = (id: string)          => api.post(`/properties/estimates/${id}/run`);

export const getEstimatePhotos  = (id: string)          => api.get(`/properties/estimates/${id}/photos`).then(d<EstimatePhoto[]>);
export const addEstimatePhoto   = (id: string, input: { area_key: string; area_label: string; url: string; storage_path: string; caption?: string; sort_order?: number }) =>
  api.post(`/properties/estimates/${id}/photos`, input).then(d<EstimatePhoto>);

export const saveEstimateAnswers = (id: string, answers: { question_key: string; answer: string }[]) =>
  api.put(`/properties/estimates/${id}/answers`, { answers });
