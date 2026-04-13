import { getServiceClient } from '../lib/supabase';
import { AppError } from '../utils/app-error';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Property {
  id: string; investor_id: string; address_line1: string; address_line2: string | null;
  city: string; state: string; zip_code: string; property_type: string;
  year_built: number | null; sqft_estimate: number | null;
  bedrooms: number | null; bathrooms: number | null;
  has_basement: boolean; has_garage: boolean; stories: number;
  created_at: string; updated_at: string;
}

export interface PropertyEstimate {
  id: string; property_id: string; investor_id: string; status: string;
  renovation_purpose: string; primary_issue: string;
  total_low: number | null; total_high: number | null;
  confidence_overall: string | null; line_items: unknown; room_breakdown: unknown;
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function db() { return getServiceClient(); }

function assertOwner(row: { investor_id: string } | null, userId: string) {
  if (!row) throw new AppError('Not found', 404);
  if (row.investor_id !== userId) throw new AppError('Forbidden', 403);
}

// ── Properties CRUD ──────────────────────────────────────────────────────────

export async function listProperties(userId: string): Promise<Property[]> {
  const { data, error } = await db()
    .from('properties').select('*')
    .eq('investor_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError('Failed to load properties', 500);
  return (data ?? []) as Property[];
}

export async function getProperty(id: string, userId: string): Promise<Property> {
  const { data, error } = await db()
    .from('properties').select('*')
    .eq('id', id).single();
  if (error || !data) throw new AppError('Property not found', 404);
  assertOwner(data as Property, userId);
  return data as Property;
}

export interface CreatePropertyInput {
  address_line1: string; address_line2?: string;
  city: string; state: string; zip_code: string; property_type: string;
  year_built?: number; sqft_estimate?: number;
  bedrooms?: number; bathrooms?: number;
  has_basement?: boolean; has_garage?: boolean; stories?: number;
}

export async function createProperty(userId: string, input: CreatePropertyInput): Promise<Property> {
  const { data, error } = await db()
    .from('properties')
    .insert({ ...input, investor_id: userId })
    .select('*').single();
  if (error || !data) throw new AppError('Failed to create property', 500);
  return data as Property;
}

export async function deleteProperty(id: string, userId: string): Promise<void> {
  const prop = await getProperty(id, userId);
  assertOwner(prop, userId);
  const { error } = await db().from('properties').delete().eq('id', id);
  if (error) throw new AppError('Failed to delete property', 500);
}

// ── Estimates ────────────────────────────────────────────────────────────────

export async function listEstimates(propertyId: string, userId: string): Promise<PropertyEstimate[]> {
  await getProperty(propertyId, userId); // ownership check
  const { data, error } = await db()
    .from('property_estimates').select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError('Failed to load estimates', 500);
  return (data ?? []) as PropertyEstimate[];
}

export async function getEstimate(id: string, userId: string): Promise<PropertyEstimate> {
  const { data, error } = await db()
    .from('property_estimates').select('*')
    .eq('id', id).single();
  if (error || !data) throw new AppError('Estimate not found', 404);
  assertOwner(data as PropertyEstimate, userId);
  return data as PropertyEstimate;
}

export interface CreateEstimateInput {
  property_id: string;
  renovation_purpose: string;
  primary_issue: string;
}

export async function createEstimate(userId: string, input: CreateEstimateInput): Promise<PropertyEstimate> {
  await getProperty(input.property_id, userId); // ownership check
  const { data, error } = await db()
    .from('property_estimates')
    .insert({
      ...input,
      investor_id:        userId,
      status:             'PROCESSING',
      processing_started: new Date().toISOString(),
    })
    .select('*').single();
  if (error || !data) throw new AppError('Failed to create estimate', 500);
  return data as PropertyEstimate;
}

export async function updateEstimate(
  id: string,
  patch: Partial<PropertyEstimate>,
): Promise<PropertyEstimate> {
  const { data, error } = await db()
    .from('property_estimates')
    .update(patch)
    .eq('id', id)
    .select('*').single();
  if (error || !data) throw new AppError('Failed to update estimate', 500);
  return data as PropertyEstimate;
}

// ── Photos ───────────────────────────────────────────────────────────────────

export async function addEstimatePhoto(input: {
  estimate_id: string | null; property_id: string;
  area_key: string; area_label: string;
  url: string; storage_path: string;
  caption?: string; sort_order?: number;
}): Promise<EstimatePhoto> {
  const { data, error } = await db()
    .from('estimate_photos')
    .insert(input)
    .select('*').single();
  if (error || !data) throw new AppError('Failed to add photo', 500);
  return data as EstimatePhoto;
}

export async function getEstimatePhotos(estimateId: string): Promise<EstimatePhoto[]> {
  const { data, error } = await db()
    .from('estimate_photos').select('*')
    .eq('estimate_id', estimateId)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError('Failed to load photos', 500);
  return (data ?? []) as EstimatePhoto[];
}

// ── Answers ──────────────────────────────────────────────────────────────────

export async function upsertAnswers(
  estimateId: string,
  answers: { question_key: string; answer: string }[],
): Promise<void> {
  const rows = answers.map(a => ({ estimate_id: estimateId, ...a }));
  const { error } = await db()
    .from('estimate_answers')
    .upsert(rows, { onConflict: 'estimate_id,question_key' });
  if (error) throw new AppError('Failed to save answers', 500);
}

export async function getAnswers(estimateId: string): Promise<{ question_key: string; answer: string }[]> {
  const { data, error } = await db()
    .from('estimate_answers').select('question_key, answer')
    .eq('estimate_id', estimateId);
  if (error) throw new AppError('Failed to load answers', 500);
  return (data ?? []) as { question_key: string; answer: string }[];
}
