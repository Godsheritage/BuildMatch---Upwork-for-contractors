import { getServiceClient } from '../lib/supabase';
import { AppError } from '../utils/app-error';
import type {
  SavedList,
  SavedContractor,
  SavedContractorIds,
} from '../types/saved.types';

// ── Raw Supabase row shapes ───────────────────────────────────────────────────

interface SavedListRow {
  id:          string;
  investor_id: string;
  name:        string;
  is_default:  boolean;
  created_at:  string;
  updated_at:  string;
}

interface SavedContractorRow {
  id:                     string;
  list_id:                string;
  investor_id:            string;
  contractor_profile_id:  string;
  note:                   string | null;
  created_at:             string;
  contractor_profiles: {
    id:               string;
    user_id:          string;
    bio:              string | null;
    specialties:      string[];
    average_rating:   number;
    total_reviews:    number;
    years_experience: number;
    completed_jobs:   number;
    hourly_rate_min:  number | null;
    hourly_rate_max:  number | null;
    city:             string | null;
    state:            string | null;
    is_available:     boolean;
    reliability_score: number;
    is_license_verified: boolean;
    users: {
      id:         string;
      first_name: string;
      last_name:  string;
      avatar_url: string | null;
    };
  };
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function toSavedList(row: SavedListRow, contractorCount = 0): SavedList {
  return {
    id:              row.id,
    investorId:      row.investor_id,
    name:            row.name,
    isDefault:       row.is_default,
    contractorCount,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

function toSavedContractor(row: SavedContractorRow): SavedContractor {
  const cp = row.contractor_profiles;
  const u  = cp.users;
  return {
    id:                    row.id,
    listId:                row.list_id,
    investorId:            row.investor_id,
    contractorProfileId:   row.contractor_profile_id,
    note:                  row.note,
    savedAt:               row.created_at,
    contractor: {
      id:                  cp.id,
      userId:              u.id,
      firstName:           u.first_name,
      lastName:            u.last_name,
      avatarUrl:           u.avatar_url,
      bio:                 cp.bio,
      specialties:         cp.specialties,
      averageRating:       cp.average_rating,
      totalReviews:        cp.total_reviews,
      yearsExperience:     cp.years_experience,
      completedJobs:       cp.completed_jobs,
      hourlyRateMin:       cp.hourly_rate_min,
      hourlyRateMax:       cp.hourly_rate_max,
      city:                cp.city,
      state:               cp.state,
      isAvailable:         cp.is_available,
      reliabilityScore:    cp.reliability_score,
      isLicenseVerified:   cp.is_license_verified,
    },
  };
}

// ── Validation helper ─────────────────────────────────────────────────────────

function validateName(name: string, field = 'name'): void {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new AppError(`List ${field} must be between 1 and 50 characters`, 400);
  }
}

// ── Service functions ─────────────────────────────────────────────────────────

// ─── getOrCreateDefaultList ──────────────────────────────────────────────────
export async function getOrCreateDefaultList(
  investorId: string,
): Promise<SavedList> {
  const supabase = getServiceClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('saved_lists')
    .select('*')
    .eq('investor_id', investorId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw new AppError('Failed to fetch saved list', 500);
  if (existing) return toSavedList(existing as SavedListRow);

  const { data: created, error: insertErr } = await supabase
    .from('saved_lists')
    .insert({
      investor_id: investorId,
      name:        'My Saved Contractors',
      is_default:  true,
    })
    .select('*')
    .single();

  if (insertErr || !created) throw new AppError('Failed to create default list', 500);
  return toSavedList(created as SavedListRow);
}

// ─── getSavedIds ─────────────────────────────────────────────────────────────
export async function getSavedIds(
  investorId: string,
): Promise<SavedContractorIds> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_contractors')
    .select('contractor_profile_id, list_id')
    .eq('investor_id', investorId);

  if (error) throw new AppError('Failed to fetch saved contractor IDs', 500);

  const saved: Record<string, string> = {};
  for (const row of (data ?? []) as { contractor_profile_id: string; list_id: string }[]) {
    saved[row.contractor_profile_id] = row.list_id;
  }

  return { saved };
}

// ─── toggleSave ──────────────────────────────────────────────────────────────
export async function toggleSave(params: {
  investorId:           string;
  contractorProfileId:  string;
  listId?:              string;
}): Promise<{ saved: boolean; listId: string }> {
  const supabase = getServiceClient();
  const { investorId, contractorProfileId } = params;

  // Resolve target list
  let listId = params.listId;
  if (!listId) {
    const defaultList = await getOrCreateDefaultList(investorId);
    listId = defaultList.id;
  }

  // Check if already saved in this list
  const { data: existing, error: checkErr } = await supabase
    .from('saved_contractors')
    .select('id')
    .eq('investor_id', investorId)
    .eq('contractor_profile_id', contractorProfileId)
    .eq('list_id', listId)
    .limit(1)
    .maybeSingle();

  if (checkErr) throw new AppError('Failed to check save status', 500);

  if (existing) {
    // Already saved — remove it
    const { error: deleteErr } = await supabase
      .from('saved_contractors')
      .delete()
      .eq('id', (existing as { id: string }).id);

    if (deleteErr) throw new AppError('Failed to unsave contractor', 500);
    return { saved: false, listId };
  }

  // Not saved — insert
  const { error: insertErr } = await supabase
    .from('saved_contractors')
    .insert({ list_id: listId, investor_id: investorId, contractor_profile_id: contractorProfileId });

  if (insertErr) throw new AppError('Failed to save contractor', 500);
  return { saved: true, listId };
}

// ─── getLists ────────────────────────────────────────────────────────────────
export async function getLists(investorId: string): Promise<SavedList[]> {
  const supabase = getServiceClient();

  const { data: lists, error: listErr } = await supabase
    .from('saved_lists')
    .select('*')
    .eq('investor_id', investorId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (listErr) throw new AppError('Failed to fetch lists', 500);
  if (!lists || lists.length === 0) return [];

  const listIds = (lists as SavedListRow[]).map((l) => l.id);

  // Count contractors per list in one query
  const { data: counts, error: countErr } = await supabase
    .from('saved_contractors')
    .select('list_id')
    .in('list_id', listIds);

  if (countErr) throw new AppError('Failed to count saved contractors', 500);

  const countMap: Record<string, number> = {};
  for (const row of (counts ?? []) as { list_id: string }[]) {
    countMap[row.list_id] = (countMap[row.list_id] ?? 0) + 1;
  }

  return (lists as SavedListRow[]).map((l) => toSavedList(l, countMap[l.id] ?? 0));
}

// ─── getListContractors ───────────────────────────────────────────────────────
export async function getListContractors(params: {
  listId:     string;
  investorId: string;
  page:       number;
  limit:      number;
}): Promise<{ contractors: SavedContractor[]; total: number }> {
  const supabase = getServiceClient();
  const { listId, investorId, page, limit } = params;

  // Verify ownership
  const { data: list, error: listErr } = await supabase
    .from('saved_lists')
    .select('id')
    .eq('id', listId)
    .eq('investor_id', investorId)
    .maybeSingle();

  if (listErr) throw new AppError('Failed to verify list ownership', 500);
  if (!list) throw new AppError('List not found or access denied', 403);

  const offset = (page - 1) * limit;

  // Fetch total
  const { count, error: countErr } = await supabase
    .from('saved_contractors')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', listId);

  if (countErr) throw new AppError('Failed to count list contractors', 500);

  // Fetch page with joins
  const { data, error: fetchErr } = await supabase
    .from('saved_contractors')
    .select(`
      id,
      list_id,
      investor_id,
      contractor_profile_id,
      note,
      created_at,
      contractor_profiles (
        id,
        user_id,
        bio,
        specialties,
        average_rating,
        total_reviews,
        years_experience,
        completed_jobs,
        hourly_rate_min,
        hourly_rate_max,
        city,
        state,
        is_available,
        reliability_score,
        is_license_verified,
        users (
          id,
          first_name,
          last_name,
          avatar_url
        )
      )
    `)
    .eq('list_id', listId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (fetchErr) throw new AppError('Failed to fetch list contractors', 500);

  return {
    contractors: (data ?? []).map((r) => toSavedContractor(r as unknown as SavedContractorRow)),
    total:       count ?? 0,
  };
}

// ─── createList ──────────────────────────────────────────────────────────────
export async function createList(params: {
  investorId: string;
  name:       string;
}): Promise<SavedList> {
  const supabase = getServiceClient();
  const name = params.name.trim();

  validateName(name);

  // Check uniqueness
  const { data: dup, error: dupErr } = await supabase
    .from('saved_lists')
    .select('id')
    .eq('investor_id', params.investorId)
    .eq('name', name)
    .maybeSingle();

  if (dupErr) throw new AppError('Failed to validate list name', 500);
  if (dup) throw new AppError('A list with that name already exists', 409);

  const { data, error } = await supabase
    .from('saved_lists')
    .insert({ investor_id: params.investorId, name, is_default: false })
    .select('*')
    .single();

  if (error || !data) throw new AppError('Failed to create list', 500);
  return toSavedList(data as SavedListRow);
}

// ─── renameList ───────────────────────────────────────────────────────────────
export async function renameList(params: {
  listId:     string;
  investorId: string;
  newName:    string;
}): Promise<SavedList> {
  const supabase = getServiceClient();
  const newName = params.newName.trim();

  validateName(newName, 'new name');

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from('saved_lists')
    .select('*')
    .eq('id', params.listId)
    .eq('investor_id', params.investorId)
    .maybeSingle();

  if (fetchErr) throw new AppError('Failed to fetch list', 500);
  if (!existing) throw new AppError('List not found or access denied', 403);

  // Check uniqueness (exclude current list)
  const { data: dup, error: dupErr } = await supabase
    .from('saved_lists')
    .select('id')
    .eq('investor_id', params.investorId)
    .eq('name', newName)
    .neq('id', params.listId)
    .maybeSingle();

  if (dupErr) throw new AppError('Failed to validate list name', 500);
  if (dup) throw new AppError('A list with that name already exists', 409);

  const { data: updated, error: updateErr } = await supabase
    .from('saved_lists')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', params.listId)
    .select('*')
    .single();

  if (updateErr || !updated) throw new AppError('Failed to rename list', 500);
  return toSavedList(updated as SavedListRow);
}

// ─── deleteList ───────────────────────────────────────────────────────────────
export async function deleteList(params: {
  listId:     string;
  investorId: string;
}): Promise<void> {
  const supabase = getServiceClient();

  const { data: list, error: fetchErr } = await supabase
    .from('saved_lists')
    .select('id, is_default')
    .eq('id', params.listId)
    .eq('investor_id', params.investorId)
    .maybeSingle();

  if (fetchErr) throw new AppError('Failed to fetch list', 500);
  if (!list) throw new AppError('List not found or access denied', 403);

  if ((list as { is_default: boolean }).is_default) {
    throw new AppError('Cannot delete your default list. Rename it instead.', 400);
  }

  const { error: deleteErr } = await supabase
    .from('saved_lists')
    .delete()
    .eq('id', params.listId);

  if (deleteErr) throw new AppError('Failed to delete list', 500);
}

// ─── moveContractor ───────────────────────────────────────────────────────────
export async function moveContractor(params: {
  savedContractorId: string;
  investorId:        string;
  targetListId:      string;
}): Promise<void> {
  const supabase = getServiceClient();
  const { savedContractorId, investorId, targetListId } = params;

  // Verify the saved entry belongs to this investor
  const { data: entry, error: entryErr } = await supabase
    .from('saved_contractors')
    .select('id, contractor_profile_id')
    .eq('id', savedContractorId)
    .eq('investor_id', investorId)
    .maybeSingle();

  if (entryErr) throw new AppError('Failed to fetch saved contractor', 500);
  if (!entry) throw new AppError('Saved contractor not found or access denied', 403);

  // Verify target list belongs to this investor
  const { data: targetList, error: listErr } = await supabase
    .from('saved_lists')
    .select('id')
    .eq('id', targetListId)
    .eq('investor_id', investorId)
    .maybeSingle();

  if (listErr) throw new AppError('Failed to fetch target list', 500);
  if (!targetList) throw new AppError('Target list not found or access denied', 403);

  // Check uniqueness in target list
  const { data: dup, error: dupErr } = await supabase
    .from('saved_contractors')
    .select('id')
    .eq('list_id', targetListId)
    .eq('contractor_profile_id', (entry as { contractor_profile_id: string }).contractor_profile_id)
    .maybeSingle();

  if (dupErr) throw new AppError('Failed to check target list', 500);
  if (dup) throw new AppError('Contractor is already in the target list', 409);

  const { error: updateErr } = await supabase
    .from('saved_contractors')
    .update({ list_id: targetListId })
    .eq('id', savedContractorId);

  if (updateErr) throw new AppError('Failed to move contractor', 500);
}

// ─── updateNote ───────────────────────────────────────────────────────────────
export async function updateNote(params: {
  savedContractorId: string;
  investorId:        string;
  note:              string;
}): Promise<void> {
  const supabase = getServiceClient();
  const { savedContractorId, investorId, note } = params;

  if (note.length > 300) {
    throw new AppError('Note must be 300 characters or fewer', 400);
  }

  // Verify ownership
  const { data: entry, error: fetchErr } = await supabase
    .from('saved_contractors')
    .select('id')
    .eq('id', savedContractorId)
    .eq('investor_id', investorId)
    .maybeSingle();

  if (fetchErr) throw new AppError('Failed to fetch saved contractor', 500);
  if (!entry) throw new AppError('Saved contractor not found or access denied', 403);

  const { error: updateErr } = await supabase
    .from('saved_contractors')
    .update({ note })
    .eq('id', savedContractorId);

  if (updateErr) throw new AppError('Failed to update note', 500);
}
