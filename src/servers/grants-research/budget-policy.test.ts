import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate_refresh_preflight } from "./refresh-policy";
import { SNAPSHOT_MONTHLY_TTL_MS } from "./sources";
import type { BudgetState, GrantSnapshot } from "./types";

const NOW_MS = Date.now();

test("no snapshot with remaining budget triggers initial refresh", () => {
	const result = evaluate_refresh_preflight({
		snapshot_before: null,
		budget_state: budget_state({ pages_remaining: 300, pages_used_total: 200 }),
		force: false,
		max_pages_per_source: 6,
		now_ms: NOW_MS,
	});

	assert.equal(result.should_refresh, true);
	assert.equal(result.reason, "monthly_refresh");
	assert.equal(result.is_early_refresh, false);
});

test("no snapshot with exhausted budget skips refresh", () => {
	const result = evaluate_refresh_preflight({
		snapshot_before: null,
		budget_state: budget_state({ pages_remaining: 0, pages_used_total: 500 }),
		force: false,
		max_pages_per_source: 6,
		now_ms: NOW_MS,
	});

	assert.equal(result.should_refresh, false);
	assert.equal(result.reason, "budget_exhausted");
});

test("fresh snapshot inside cooldown window serves cache", () => {
	const result = evaluate_refresh_preflight({
		snapshot_before: snapshot_days_ago(5),
		budget_state: budget_state({ pages_remaining: 250, pages_used_total: 250 }),
		force: false,
		max_pages_per_source: 6,
		now_ms: NOW_MS,
	});

	assert.equal(result.should_refresh, false);
	assert.equal(result.reason, "fresh_cache");
});

test("fresh snapshot outside cooldown allows conservative early refresh", () => {
	const result = evaluate_refresh_preflight({
		snapshot_before: snapshot_days_ago(20),
		budget_state: budget_state({ pages_remaining: 10, pages_used_total: 490 }),
		force: false,
		max_pages_per_source: 6,
		now_ms: NOW_MS,
	});

	assert.equal(result.should_refresh, true);
	assert.equal(result.reason, "early_refresh");
	assert.equal(result.max_pages_this_run, 2);
	assert.equal(result.is_early_refresh, true);
});

test("stale snapshot triggers monthly refresh when budget is healthy", () => {
	const result = evaluate_refresh_preflight({
		snapshot_before: snapshot_days_ago(31),
		budget_state: budget_state({ pages_remaining: 8, pages_used_total: 492 }),
		force: false,
		max_pages_per_source: 6,
		now_ms: NOW_MS,
	});

	assert.equal(result.should_refresh, true);
	assert.equal(result.reason, "monthly_refresh");
	assert.equal(result.is_early_refresh, false);
});

test("stale snapshot with too little remaining budget is skipped", () => {
	const result = evaluate_refresh_preflight({
		snapshot_before: snapshot_days_ago(31),
		budget_state: budget_state({ pages_remaining: 1, pages_used_total: 499 }),
		force: false,
		max_pages_per_source: 6,
		now_ms: NOW_MS,
	});

	assert.equal(result.should_refresh, false);
	assert.equal(result.reason, "budget_low");
});

function budget_state(
	overrides: Partial<BudgetState> = {},
): BudgetState {
	return {
		total_pages_cap: 500,
		pages_used_total: 0,
		pages_remaining: 500,
		refresh_count: 0,
		...overrides,
	};
}

function snapshot_days_ago(days_ago: number): GrantSnapshot {
	const updated_at_ms = NOW_MS - days_ago * 24 * 60 * 60 * 1000;
	const updated_at = new Date(updated_at_ms).toISOString();
	return {
		version: "1.0.0",
		updated_at,
		fresh_until: new Date(updated_at_ms + SNAPSHOT_MONTHLY_TTL_MS).toISOString(),
		next_scheduled_refresh_at: new Date(
			updated_at_ms + 6 * 60 * 60 * 1000,
		).toISOString(),
		last_refresh_mode: "manual",
		refresh_decision_reason: "monthly_refresh",
		budget: {
			total_pages_cap: 500,
			pages_used_total: 100,
			pages_remaining: 400,
			pages_used_this_refresh: 4,
		},
		stats: {
			total_sources: 4,
			total_pages: 4,
			total_candidates: 12,
			total_grants: 10,
			open_grants: 7,
		},
		sources: [],
		grants: [],
		errors: [],
	};
}
