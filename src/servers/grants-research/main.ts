import { z } from "zod";
import { McpAgent } from "agents/mcp";
import { defineMcpServer, defineTool } from "../../shared/mcp-server-creator";
import { FirecrawlClient } from "./firecrawl-client";
import { extract_grant_candidates, score_candidates } from "./grant-extractor";
import {
	ABSOLUTE_MAX_PAGES_PER_SOURCE,
	ABSOLUTE_MAX_RESULTS,
	DEFAULT_MAX_RESULTS,
	DEFAULT_MIN_OPEN_SCORE,
	DEFAULT_REFRESH_INTERVAL_SECONDS,
	DEFAULT_STALE_AFTER_MS,
	GRANT_SOURCES,
	SNAPSHOT_MONTHLY_TTL_MS,
} from "./sources";
import { evaluate_refresh_preflight } from "./refresh-policy";
import {
	commit_budget_usage,
	get_budget_state,
	get_schedule_id,
	get_snapshot,
	is_snapshot_stale,
	release_budget_reservation,
	release_refresh_lock,
	reserve_budget_pages,
	save_schedule_id,
	save_snapshot,
	try_acquire_refresh_lock,
} from "./snapshot-storage";
import type {
	BudgetState,
	GrantRecord,
	GrantSnapshot,
	GrantsAgentRuntime,
	RefreshDecisionReason,
	RefreshMode,
	RefreshResult,
	SourceRefreshStats,
} from "./types";

const LOCK_TTL_MS = 1000 * 60 * 8;
const SCHEDULE_CALLBACK_NAME = "scheduled_refresh_tick";

const { McpServerClass: GrantsResearchBase, metadata: grantsResearchDataBase } =
	defineMcpServer({
		name: "Grants Research",
		version: "1.0.0",
		binding: "grantsResearch",
		url_prefix: "/grants-research",
		tools: [
			defineTool({
				name: "refresh_grants",
				description:
					"Refreshes grant opportunities from configured funding sources and updates the cached snapshot.",
				inputSchema: {
					force: z.boolean().optional(),
					max_pages_per_source: z.number().int().min(1).max(15).optional(),
					min_open_score: z.number().int().min(0).max(100).optional(),
				},
				function: async function (
					this: unknown,
					{
						force,
						max_pages_per_source,
						min_open_score,
					}: {
						force?: boolean;
						max_pages_per_source?: number;
						min_open_score?: number;
					},
				) {
					try {
						const agent = this as GrantsAgentRuntime;
						await ensure_refresh_schedule(agent);
						const result = await refresh_snapshot(agent, {
							mode: "manual",
							force: force ?? false,
							max_pages_per_source: max_pages_per_source ?? 6,
						});
						const min_score = min_open_score ?? DEFAULT_MIN_OPEN_SCORE;
						const grants = result.snapshot.grants.filter(
							(grant) => grant.open_score >= min_score,
						);

						return tool_success({
							refreshed: result.refreshed,
							message: result.message,
							refresh_decision_reason: result.decision_reason,
							pages_used_this_refresh: result.pages_used_this_refresh,
							pages_remaining:
								result.snapshot.budget?.pages_remaining ??
								0,
							fresh_until: result.snapshot.fresh_until,
							min_open_score: min_score,
							open_grants: grants.length,
							snapshot_stats: result.snapshot.stats,
							sources: result.snapshot.sources,
							errors: result.snapshot.errors,
							budget: result.snapshot.budget,
							grants,
						});
					} catch (error) {
						return tool_error("refresh_grants", error);
					}
				},
			}),
			defineTool({
				name: "list_open_grants",
				description:
					"Lists cached open grants quickly with optional filtering and query matching.",
				inputSchema: {
					source_id: z.string().optional(),
					min_score: z.number().int().min(0).max(100).optional(),
					limit: z.number().int().min(1).max(200).optional(),
					query: z.string().min(1).optional(),
					include_borderline: z.boolean().optional(),
					auto_refresh_if_stale: z.boolean().optional(),
				},
				function: async function (
					this: unknown,
					{
						source_id,
						min_score,
						limit,
						query,
						include_borderline,
						auto_refresh_if_stale,
					}: {
						source_id?: string;
						min_score?: number;
						limit?: number;
						query?: string;
						include_borderline?: boolean;
						auto_refresh_if_stale?: boolean;
					},
				) {
					try {
						const agent = this as GrantsAgentRuntime;
						await ensure_refresh_schedule(agent);
						let budget_state = await get_budget_state(agent.ctx.storage);
						let snapshot = await get_snapshot(agent.ctx.storage);
						const should_auto_refresh =
							auto_refresh_if_stale !== false &&
							is_snapshot_stale(snapshot, DEFAULT_STALE_AFTER_MS);

						let refresh_decision_reason: RefreshDecisionReason | undefined;
						if (should_auto_refresh) {
							const refresh_result = await refresh_snapshot(agent, {
								mode: "auto",
								force: false,
								max_pages_per_source: 6,
							});
							snapshot = refresh_result.snapshot;
							refresh_decision_reason = refresh_result.decision_reason;
							budget_state = await get_budget_state(agent.ctx.storage);
						}

						if (!snapshot) {
							return tool_success({
								message: "No cached grants available yet. Call refresh_grants first.",
								pages_remaining: budget_state.pages_remaining,
								refresh_decision_reason: "fresh_cache",
								budget: budget_payload(budget_state, 0),
								grants: [],
							});
						}

						const normalized_snapshot = with_snapshot_defaults(
							snapshot,
							budget_state,
							refresh_decision_reason,
						);
						const grants = filter_grants(snapshot.grants, {
							source_id,
							min_score: min_score ?? DEFAULT_MIN_OPEN_SCORE,
							limit: limit ?? DEFAULT_MAX_RESULTS,
							query,
							include_borderline: include_borderline ?? true,
						});

						return tool_success({
							updated_at: normalized_snapshot.updated_at,
							fresh_until: normalized_snapshot.fresh_until,
							next_scheduled_refresh_at:
								normalized_snapshot.next_scheduled_refresh_at,
							refresh_decision_reason:
								normalized_snapshot.refresh_decision_reason,
							total_grants: normalized_snapshot.stats.total_grants,
							returned_grants: grants.length,
							pages_remaining:
								normalized_snapshot.budget?.pages_remaining ?? 0,
							budget: normalized_snapshot.budget,
							grants,
						});
					} catch (error) {
						return tool_error("list_open_grants", error);
					}
				},
			}),
			defineTool({
				name: "get_grant_snapshot_meta",
				description:
					"Returns metadata and source health for the last grant snapshot refresh.",
				function: async function () {
					try {
						const agent = this as unknown as GrantsAgentRuntime;
						await ensure_refresh_schedule(agent);
						const budget_state = await get_budget_state(agent.ctx.storage);
						const snapshot = await get_snapshot(agent.ctx.storage);
						if (!snapshot) {
							return tool_success({
								message: "Snapshot is empty. Run refresh_grants to fetch data.",
								has_snapshot: false,
								pages_remaining: budget_state.pages_remaining,
								budget: budget_payload(budget_state, 0),
							});
						}
						const normalized_snapshot = with_snapshot_defaults(
							snapshot,
							budget_state,
						);

						return tool_success({
							has_snapshot: true,
							updated_at: normalized_snapshot.updated_at,
							fresh_until: normalized_snapshot.fresh_until,
							next_scheduled_refresh_at:
								normalized_snapshot.next_scheduled_refresh_at,
							last_refresh_mode: normalized_snapshot.last_refresh_mode,
							refresh_decision_reason:
								normalized_snapshot.refresh_decision_reason,
							stats: normalized_snapshot.stats,
							sources: normalized_snapshot.sources,
							errors: normalized_snapshot.errors,
							budget: normalized_snapshot.budget,
						});
					} catch (error) {
						return tool_error("get_grant_snapshot_meta", error);
					}
				},
			}),
		],
	});

export class GrantsResearchServer extends GrantsResearchBase {
	override async onStart(props?: Record<string, unknown>): Promise<void> {
		await super.onStart(props);
		await ensure_refresh_schedule(this as unknown as GrantsAgentRuntime);
	}

	async scheduled_refresh_tick(): Promise<void> {
		await refresh_snapshot(this as unknown as GrantsAgentRuntime, {
			mode: "scheduled",
			force: false,
			max_pages_per_source: 4,
		});
	}
}

export const grantsResearchData = {
	...grantsResearchDataBase,
	server: GrantsResearchServer as unknown as typeof McpAgent,
};

type RefreshSnapshotParams = {
	mode: RefreshMode;
	force: boolean;
	max_pages_per_source: number;
};

async function refresh_snapshot(
	agent: GrantsAgentRuntime,
	{
		mode,
		force,
		max_pages_per_source,
	}: RefreshSnapshotParams,
): Promise<RefreshResult> {
	const budget_before = await get_budget_state(agent.ctx.storage);
	const snapshot_before_raw = await get_snapshot(agent.ctx.storage);
	const snapshot_before = snapshot_before_raw
		? with_snapshot_defaults(snapshot_before_raw, budget_before)
		: null;
	const preflight = evaluate_refresh_preflight({
		snapshot_before,
		budget_state: budget_before,
		force,
		max_pages_per_source,
		now_ms: Date.now(),
	});

	if (!preflight.should_refresh) {
		if (snapshot_before) {
			const snapshot = with_snapshot_defaults(
				snapshot_before,
				budget_before,
				preflight.reason,
			);
			return {
				snapshot,
				refreshed: false,
				message: preflight.message,
				decision_reason: preflight.reason,
				pages_used_this_refresh: 0,
			};
		}

		const empty_snapshot = create_empty_snapshot({
			mode,
			reason: preflight.reason,
			budget_state: budget_before,
			message: preflight.message,
		});
		return {
			snapshot: empty_snapshot,
			refreshed: false,
			message: preflight.message,
			decision_reason: preflight.reason,
			pages_used_this_refresh: 0,
		};
	}

	const lock_acquired = await try_acquire_refresh_lock(agent.ctx.storage, LOCK_TTL_MS);
	if (!lock_acquired) {
		const existing = await get_snapshot(agent.ctx.storage);
		const budget_now = await get_budget_state(agent.ctx.storage);
		if (existing) {
			const snapshot = with_snapshot_defaults(existing, budget_now);
			return {
				snapshot,
				refreshed: false,
				message: "Refresh skipped because another refresh is currently running.",
				decision_reason: snapshot.refresh_decision_reason ?? "fresh_cache",
				pages_used_this_refresh: 0,
			};
		}
		throw new Error("Refresh lock is held and no snapshot is available yet.");
	}

	let budget_reserved = false;
	try {
		const reserved_pages = await reserve_budget_pages(
			agent.ctx.storage,
			preflight.max_pages_this_run,
			LOCK_TTL_MS,
		);
		if (reserved_pages <= 0) {
			const reason: RefreshDecisionReason =
				budget_before.pages_remaining <= 0 ? "budget_exhausted" : "budget_low";
			const existing = await get_snapshot(agent.ctx.storage);
			if (existing) {
				const snapshot = with_snapshot_defaults(existing, budget_before, reason);
				return {
					snapshot,
					refreshed: false,
					message: "Skipped refresh because remaining page budget is too low.",
					decision_reason: reason,
					pages_used_this_refresh: 0,
				};
			}
			const empty_snapshot = create_empty_snapshot({
				mode,
				reason,
				budget_state: budget_before,
				message: "Skipped refresh because remaining page budget is too low.",
			});
			return {
				snapshot: empty_snapshot,
				refreshed: false,
				message: "Skipped refresh because remaining page budget is too low.",
				decision_reason: reason,
				pages_used_this_refresh: 0,
			};
		}
		budget_reserved = true;

		const firecrawl_api_key = get_firecrawl_api_key(agent.env);
		const firecrawl = new FirecrawlClient(firecrawl_api_key, {
			max_retries: 2,
			min_delay_ms: 700,
			jitter_ms: 350,
		});

		const now_iso = new Date().toISOString();
		const source_stats: SourceRefreshStats[] = [];
		const errors: string[] = [];
		const all_candidates: ReturnType<typeof extract_grant_candidates> = [];
		let total_pages = 0;
		let remaining_run_budget = reserved_pages;

		for (const source of GRANT_SOURCES) {
			if (remaining_run_budget <= 0) break;
			const started_at = Date.now();
			try {
				const page_limit =
					source.strategy === "crawl"
						? Math.min(
								max_pages_per_source,
								ABSOLUTE_MAX_PAGES_PER_SOURCE,
								remaining_run_budget,
							)
						: Math.min(1, remaining_run_budget);
				if (page_limit <= 0) break;

				const fetched_pages =
					source.strategy === "crawl"
						? await firecrawl.crawl_source(source, page_limit)
						: await firecrawl.scrape_source(source);
				const pages = fetched_pages.slice(0, remaining_run_budget);
				const candidates = extract_grant_candidates(source, pages);

				total_pages += pages.length;
				remaining_run_budget -= pages.length;
				all_candidates.push(...candidates);
				source_stats.push({
					source_id: source.id,
					source_name: source.name,
					source_url: source.entry_url,
					strategy: source.strategy,
					pages_fetched: pages.length,
					candidates_extracted: candidates.length,
					duration_ms: Date.now() - started_at,
					status: "ok",
				});
			} catch (error) {
				const error_message = error_to_string(error);
				errors.push(`Source ${source.id}: ${error_message}`);
				source_stats.push({
					source_id: source.id,
					source_name: source.name,
					source_url: source.entry_url,
					strategy: source.strategy,
					pages_fetched: 0,
					candidates_extracted: 0,
					duration_ms: Date.now() - started_at,
					status: "error",
					error: error_message,
				});
			}
		}

		const scored_grants = score_candidates(all_candidates, now_iso);
		const open_grants = scored_grants.filter(
			(grant) => grant.open_score >= DEFAULT_MIN_OPEN_SCORE,
		).length;
		const budget_after = await commit_budget_usage(agent.ctx.storage, {
			actual_pages_used: total_pages,
			refreshed_at_iso: now_iso,
			was_early_refresh: preflight.is_early_refresh,
		});
		budget_reserved = false;

		const snapshot: GrantSnapshot = {
			version: "1.0.0",
			updated_at: now_iso,
			fresh_until: compute_fresh_until(now_iso),
			next_scheduled_refresh_at: new Date(
				Date.now() + DEFAULT_REFRESH_INTERVAL_SECONDS * 1000,
			).toISOString(),
			last_refresh_mode: mode,
			refresh_decision_reason: preflight.reason,
			budget: budget_payload(budget_after, total_pages),
			stats: {
				total_sources: GRANT_SOURCES.length,
				total_pages: total_pages,
				total_candidates: all_candidates.length,
				total_grants: scored_grants.length,
				open_grants: open_grants,
			},
			sources: source_stats,
			grants: scored_grants,
			errors,
		};

		await save_snapshot(agent.ctx.storage, snapshot);
		return {
			snapshot,
			refreshed: true,
			message: `Refresh completed in ${mode} mode.`,
			decision_reason: preflight.reason,
			pages_used_this_refresh: total_pages,
		};
	} finally {
		if (budget_reserved) await release_budget_reservation(agent.ctx.storage);
		await release_refresh_lock(agent.ctx.storage);
	}
}


function with_snapshot_defaults(
	snapshot: GrantSnapshot,
	budget_state: BudgetState,
	override_reason?: RefreshDecisionReason,
): GrantSnapshot {
	return {
		...snapshot,
		fresh_until: snapshot.fresh_until ?? compute_fresh_until(snapshot.updated_at),
		refresh_decision_reason:
			override_reason ?? snapshot.refresh_decision_reason ?? "monthly_refresh",
		budget: budget_payload(
			budget_state,
			snapshot.budget?.pages_used_this_refresh ?? snapshot.stats.total_pages,
		),
	};
}

function budget_payload(budget_state: BudgetState, pages_used_this_refresh: number) {
	return {
		total_pages_cap: budget_state.total_pages_cap,
		pages_used_total: budget_state.pages_used_total,
		pages_remaining: budget_state.pages_remaining,
		pages_used_this_refresh: Math.max(0, pages_used_this_refresh),
	};
}

function create_empty_snapshot({
	mode,
	reason,
	budget_state,
	message,
}: {
	mode: RefreshMode;
	reason: RefreshDecisionReason;
	budget_state: BudgetState;
	message: string;
}): GrantSnapshot {
	const now_iso = new Date().toISOString();
	return {
		version: "1.0.0",
		updated_at: now_iso,
		fresh_until: compute_fresh_until(now_iso),
		next_scheduled_refresh_at: new Date(
			Date.now() + DEFAULT_REFRESH_INTERVAL_SECONDS * 1000,
		).toISOString(),
		last_refresh_mode: mode,
		refresh_decision_reason: reason,
		budget: budget_payload(budget_state, 0),
		stats: {
			total_sources: GRANT_SOURCES.length,
			total_pages: 0,
			total_candidates: 0,
			total_grants: 0,
			open_grants: 0,
		},
		sources: [],
		grants: [],
		errors: [message],
	};
}

function compute_fresh_until(updated_at_iso: string): string {
	const updated_at = new Date(updated_at_iso).getTime();
	const baseline = Number.isNaN(updated_at) ? Date.now() : updated_at;
	return new Date(baseline + SNAPSHOT_MONTHLY_TTL_MS).toISOString();
}


async function ensure_refresh_schedule(agent: GrantsAgentRuntime): Promise<void> {
	const schedules = agent.getSchedules({ type: "interval" });
	const existing_matching = schedules.find(
		(schedule) => schedule.callback === SCHEDULE_CALLBACK_NAME,
	);
	if (existing_matching) {
		await save_schedule_id(agent.ctx.storage, existing_matching.id);
		return;
	}

	const known_schedule_id = await get_schedule_id(agent.ctx.storage);
	if (known_schedule_id) await agent.cancelSchedule(known_schedule_id);

	const created = await agent.scheduleEvery(
		DEFAULT_REFRESH_INTERVAL_SECONDS,
		SCHEDULE_CALLBACK_NAME,
	);
	await save_schedule_id(agent.ctx.storage, created.id);
}

function filter_grants(
	grants: GrantRecord[],
	{
		source_id,
		min_score,
		limit,
		query,
		include_borderline,
	}: {
		source_id?: string;
		min_score: number;
		limit: number;
		query?: string;
		include_borderline: boolean;
	},
): GrantRecord[] {
	const bounded_limit = Math.min(Math.max(1, limit), ABSOLUTE_MAX_RESULTS);
	const normalized_query = query?.toLowerCase().trim();

	const filtered = grants.filter((grant) => {
		if (source_id && grant.source_id !== source_id) return false;

		if (!include_borderline && grant.open_score < min_score) return false;
		if (include_borderline && grant.open_score < Math.max(0, min_score - 10))
			return false;

		if (!normalized_query) return true;

		const haystack = `${grant.title}\n${grant.excerpt}\n${grant.url}`.toLowerCase();
		return haystack.includes(normalized_query);
	});

	return filtered.slice(0, bounded_limit);
}

function get_firecrawl_api_key(env: Env): string {
	const maybe_key = (env as unknown as Record<string, unknown>).FIRECRAWL_API_KEY;
	if (typeof maybe_key !== "string" || maybe_key.trim().length === 0) {
		throw new Error(
			"Missing FIRECRAWL_API_KEY. Set it with `wrangler secret put FIRECRAWL_API_KEY`.",
		);
	}
	return maybe_key.trim();
}

function error_to_string(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown error";
}

function tool_error(tool_name: string, error: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{
						error: `Tool ${tool_name} failed`,
						details: error_to_string(error),
					},
					null,
					2,
				),
			},
		],
		isError: true,
	};
}

function tool_success(payload: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(payload, null, 2),
			},
		],
	};
}
