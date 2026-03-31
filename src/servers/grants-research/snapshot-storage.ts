import { FIRECRAWL_PAGE_BUDGET_TOTAL } from "./sources";
import type { BudgetState, GrantSnapshot } from "./types";

const SNAPSHOT_KEY = "grants:snapshot:v1";
const REFRESH_LOCK_KEY = "grants:refresh-lock:v1";
const SCHEDULE_ID_KEY = "grants:schedule-id:v1";
const BUDGET_STATE_KEY = "grants:budget-state:v1";
const BUDGET_RESERVATION_KEY = "grants:budget-reservation:v1";

type RefreshLock = {
	until_epoch_ms: number;
};

type BudgetReservation = {
	reserved_pages: number;
	until_epoch_ms: number;
};

type CommitBudgetUsageOptions = {
	actual_pages_used: number;
	refreshed_at_iso: string;
	was_early_refresh: boolean;
};

export async function get_snapshot(
	storage: DurableObjectStorage,
): Promise<GrantSnapshot | null> {
	const snapshot = await storage.get<GrantSnapshot>(SNAPSHOT_KEY);
	return snapshot ?? null;
}

export async function save_snapshot(
	storage: DurableObjectStorage,
	snapshot: GrantSnapshot,
): Promise<void> {
	await storage.put(SNAPSHOT_KEY, snapshot);
}

export function is_snapshot_stale(
	snapshot: GrantSnapshot | null,
	stale_after_ms: number,
): boolean {
	if (!snapshot) return true;
	const fresh_until = snapshot.fresh_until
		? new Date(snapshot.fresh_until).getTime()
		: Number.NaN;
	if (!Number.isNaN(fresh_until)) return Date.now() > fresh_until;
	const updated_at = new Date(snapshot.updated_at).getTime();
	if (Number.isNaN(updated_at)) return true;
	return Date.now() - updated_at > stale_after_ms;
}

export async function try_acquire_refresh_lock(
	storage: DurableObjectStorage,
	lock_ttl_ms: number,
): Promise<boolean> {
	const now = Date.now();
	const existing = await storage.get<RefreshLock>(REFRESH_LOCK_KEY);
	if (existing && existing.until_epoch_ms > now) return false;
	await storage.put(REFRESH_LOCK_KEY, { until_epoch_ms: now + lock_ttl_ms });
	return true;
}

export async function release_refresh_lock(
	storage: DurableObjectStorage,
): Promise<void> {
	await storage.delete(REFRESH_LOCK_KEY);
}

export async function get_schedule_id(
	storage: DurableObjectStorage,
): Promise<string | null> {
	return (await storage.get<string>(SCHEDULE_ID_KEY)) ?? null;
}

export async function save_schedule_id(
	storage: DurableObjectStorage,
	schedule_id: string,
): Promise<void> {
	await storage.put(SCHEDULE_ID_KEY, schedule_id);
}

export async function get_budget_state(
	storage: DurableObjectStorage,
): Promise<BudgetState> {
	const stored = await storage.get<BudgetState>(BUDGET_STATE_KEY);
	if (!stored) return default_budget_state();
	return normalize_budget_state(stored);
}

export async function save_budget_state(
	storage: DurableObjectStorage,
	state: BudgetState,
): Promise<void> {
	await storage.put(BUDGET_STATE_KEY, normalize_budget_state(state));
}

export async function reserve_budget_pages(
	storage: DurableObjectStorage,
	max_pages_to_reserve: number,
	reservation_ttl_ms = 1000 * 60 * 8,
): Promise<number> {
	const requested = Math.max(0, Math.floor(max_pages_to_reserve));
	if (requested <= 0) return 0;

	const now = Date.now();
	const existing = await storage.get<BudgetReservation>(BUDGET_RESERVATION_KEY);
	if (existing && existing.until_epoch_ms > now) return 0;

	const budget_state = await get_budget_state(storage);
	if (budget_state.pages_remaining <= 0) return 0;

	const reserved_pages = Math.min(requested, budget_state.pages_remaining);
	if (reserved_pages <= 0) return 0;

	await storage.put(BUDGET_RESERVATION_KEY, {
		reserved_pages,
		until_epoch_ms: now + reservation_ttl_ms,
	} satisfies BudgetReservation);
	return reserved_pages;
}

export async function commit_budget_usage(
	storage: DurableObjectStorage,
	{
		actual_pages_used,
		refreshed_at_iso,
		was_early_refresh,
	}: CommitBudgetUsageOptions,
): Promise<BudgetState> {
	const reservation = await storage.get<BudgetReservation>(BUDGET_RESERVATION_KEY);
	const budget_state = await get_budget_state(storage);

	const max_chargeable = reservation
		? reservation.reserved_pages
		: budget_state.pages_remaining;
	const bounded_actual = Math.max(0, Math.floor(actual_pages_used));
	const charged_pages = Math.min(bounded_actual, Math.max(0, max_chargeable));

	const pages_used_total = Math.min(
		budget_state.total_pages_cap,
		budget_state.pages_used_total + charged_pages,
	);
	const next_budget_state: BudgetState = {
		total_pages_cap: budget_state.total_pages_cap,
		pages_used_total,
		pages_remaining: Math.max(0, budget_state.total_pages_cap - pages_used_total),
		refresh_count: budget_state.refresh_count + 1,
		last_refresh_at: refreshed_at_iso,
		last_early_refresh_at: was_early_refresh
			? refreshed_at_iso
			: budget_state.last_early_refresh_at,
	};

	await storage.put(BUDGET_STATE_KEY, next_budget_state);
	await storage.delete(BUDGET_RESERVATION_KEY);
	return next_budget_state;
}

export async function release_budget_reservation(
	storage: DurableObjectStorage,
): Promise<void> {
	await storage.delete(BUDGET_RESERVATION_KEY);
}

function default_budget_state(): BudgetState {
	return {
		total_pages_cap: FIRECRAWL_PAGE_BUDGET_TOTAL,
		pages_used_total: 0,
		pages_remaining: FIRECRAWL_PAGE_BUDGET_TOTAL,
		refresh_count: 0,
	};
}

function normalize_budget_state(state: BudgetState): BudgetState {
	const cap = Math.max(0, Math.floor(state.total_pages_cap || FIRECRAWL_PAGE_BUDGET_TOTAL));
	const used = Math.min(cap, Math.max(0, Math.floor(state.pages_used_total || 0)));
	const remaining = Math.max(0, cap - used);
	const refresh_count = Math.max(0, Math.floor(state.refresh_count || 0));

	return {
		total_pages_cap: cap,
		pages_used_total: used,
		pages_remaining: remaining,
		refresh_count,
		last_refresh_at: state.last_refresh_at,
		last_early_refresh_at: state.last_early_refresh_at,
	};
}
