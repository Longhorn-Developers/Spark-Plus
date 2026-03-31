import {
	DEFAULT_MAX_PAGES_PER_RUN,
	DEFAULT_STALE_AFTER_MS,
	EARLY_REFRESH_MAX_PAGES_PER_RUN,
	EARLY_REFRESH_MIN_DAYS_SINCE_LAST,
	FIRECRAWL_MIN_PAGES_TO_REFRESH,
	GRANT_SOURCES,
} from "./sources";
import { is_snapshot_stale } from "./snapshot-storage";
import type {
	BudgetState,
	GrantSnapshot,
	RefreshDecisionReason,
} from "./types";

export type RefreshPreflight = {
	should_refresh: boolean;
	reason: RefreshDecisionReason;
	message: string;
	max_pages_this_run: number;
	is_early_refresh: boolean;
};

export function evaluate_refresh_preflight({
	snapshot_before,
	budget_state,
	force,
	max_pages_per_source,
	now_ms,
}: {
	snapshot_before: GrantSnapshot | null;
	budget_state: BudgetState;
	force: boolean;
	max_pages_per_source: number;
	now_ms: number;
}): RefreshPreflight {
	const monthly_run_budget = Math.min(
		Math.max(1, max_pages_per_source) * GRANT_SOURCES.length,
		DEFAULT_MAX_PAGES_PER_RUN,
		budget_state.pages_remaining,
	);
	const early_run_budget = Math.min(
		Math.max(1, max_pages_per_source) * GRANT_SOURCES.length,
		EARLY_REFRESH_MAX_PAGES_PER_RUN,
		budget_state.pages_remaining,
	);

	if (budget_state.pages_remaining <= 0) {
		return {
			should_refresh: false,
			reason: "budget_exhausted",
			message: "Skipped refresh because the lifetime page budget has been exhausted.",
			max_pages_this_run: 0,
			is_early_refresh: false,
		};
	}

	if (!snapshot_before) {
		if (monthly_run_budget < FIRECRAWL_MIN_PAGES_TO_REFRESH) {
			return {
				should_refresh: false,
				reason: "budget_low",
				message:
					"Skipped refresh because remaining page budget is below the minimum run threshold.",
				max_pages_this_run: 0,
				is_early_refresh: false,
			};
		}
		return {
			should_refresh: true,
			reason: "monthly_refresh",
			message: "Running initial snapshot refresh.",
			max_pages_this_run: monthly_run_budget,
			is_early_refresh: false,
		};
	}

	const monthly_stale = is_snapshot_stale(snapshot_before, DEFAULT_STALE_AFTER_MS);
	if (force) {
		const force_reason: RefreshDecisionReason = monthly_stale
			? "monthly_refresh"
			: "early_refresh";
		return {
			should_refresh: true,
			reason: force_reason,
			message: "Forced refresh requested.",
			max_pages_this_run: Math.max(1, monthly_run_budget),
			is_early_refresh: !monthly_stale,
		};
	}

	if (monthly_stale) {
		if (monthly_run_budget < FIRECRAWL_MIN_PAGES_TO_REFRESH) {
			return {
				should_refresh: false,
				reason: "budget_low",
				message:
					"Skipped monthly refresh because remaining page budget is below the minimum run threshold.",
				max_pages_this_run: 0,
				is_early_refresh: false,
			};
		}
		return {
			should_refresh: true,
			reason: "monthly_refresh",
			message: "Running monthly refresh because cached snapshot is stale.",
			max_pages_this_run: monthly_run_budget,
			is_early_refresh: false,
		};
	}

	const days_since_last_refresh = days_since_iso(snapshot_before.updated_at, now_ms);
	if (days_since_last_refresh < EARLY_REFRESH_MIN_DAYS_SINCE_LAST) {
		return {
			should_refresh: false,
			reason: "fresh_cache",
			message: "Skipped refresh because the cache is still within monthly freshness window.",
			max_pages_this_run: 0,
			is_early_refresh: false,
		};
	}

	if (early_run_budget < FIRECRAWL_MIN_PAGES_TO_REFRESH) {
		return {
			should_refresh: false,
			reason: "budget_low",
			message:
				"Skipped early refresh because remaining page budget is below the minimum run threshold.",
			max_pages_this_run: 0,
			is_early_refresh: false,
		};
	}

	return {
		should_refresh: true,
		reason: "early_refresh",
		message: "Running conservative early refresh under budget guardrails.",
		max_pages_this_run: early_run_budget,
		is_early_refresh: true,
	};
}

function days_since_iso(timestamp_iso: string, now_ms: number): number {
	const ts = new Date(timestamp_iso).getTime();
	if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
	return Math.floor((now_ms - ts) / (1000 * 60 * 60 * 24));
}
