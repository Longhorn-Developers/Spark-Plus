export type RefreshMode = "manual" | "scheduled" | "auto";
export type RefreshDecisionReason =
	| "fresh_cache"
	| "early_refresh"
	| "monthly_refresh"
	| "budget_exhausted"
	| "budget_low";

export type SourceStrategy = "scrape" | "crawl";

export type GrantSourceConfig = {
	id: string;
	name: string;
	base_url: string;
	entry_url: string;
	strategy: SourceStrategy;
	scrape_options?: {
		wait_for_ms?: number;
	};
	crawl?: {
		include_paths?: string[];
		exclude_paths?: string[];
		limit?: number;
		max_discovery_depth?: number;
		delay_seconds?: number;
		max_concurrency?: number;
	};
};

export type FirecrawlPage = {
	url: string;
	source_url: string;
	title?: string;
	markdown: string;
	links: string[];
	status_code?: number;
	warning?: string;
	raw?: unknown;
};

export type GrantCandidate = {
	source_id: string;
	source_name: string;
	source_url: string;
	url: string;
	title: string;
	excerpt: string;
	raw_text: string;
	deadline_text?: string;
};

export type GrantRecord = {
	id: string;
	source_id: string;
	source_name: string;
	source_url: string;
	url: string;
	title: string;
	excerpt: string;
	deadline_text?: string;
	open_score: number;
	is_likely_open: boolean;
	reasons: string[];
	fetched_at: string;
};

export type SourceRefreshStats = {
	source_id: string;
	source_name: string;
	source_url: string;
	strategy: SourceStrategy;
	pages_fetched: number;
	candidates_extracted: number;
	duration_ms: number;
	status: "ok" | "error";
	error?: string;
};

export type GrantSnapshot = {
	version: "1.0.0";
	updated_at: string;
	fresh_until?: string;
	next_scheduled_refresh_at: string;
	last_refresh_mode: RefreshMode;
	refresh_decision_reason?: RefreshDecisionReason;
	budget?: {
		total_pages_cap: number;
		pages_used_total: number;
		pages_remaining: number;
		pages_used_this_refresh: number;
	};
	stats: {
		total_sources: number;
		total_pages: number;
		total_candidates: number;
		total_grants: number;
		open_grants: number;
	};
	sources: SourceRefreshStats[];
	grants: GrantRecord[];
	errors: string[];
};

export type RefreshOptions = {
	mode: RefreshMode;
	force: boolean;
};

export type RefreshResult = {
	snapshot: GrantSnapshot;
	refreshed: boolean;
	message: string;
	decision_reason: RefreshDecisionReason;
	pages_used_this_refresh: number;
};

export type BudgetState = {
	total_pages_cap: number;
	pages_used_total: number;
	pages_remaining: number;
	refresh_count: number;
	last_refresh_at?: string;
	last_early_refresh_at?: string;
};

export type GrantsAgentRuntime = {
	ctx: DurableObjectState;
	env: Env;
	getSchedules: (criteria?: {
		id?: string;
		type?: "scheduled" | "delayed" | "cron" | "interval";
		timeRange?: {
			start?: Date;
			end?: Date;
		};
	}) => Array<{ id: string; callback: string; type: string }>;
	scheduleEvery: (
		intervalSeconds: number,
		callback: string,
		payload?: unknown,
		options?: { retry?: { maxAttempts?: number } },
	) => Promise<{ id: string }>;
	cancelSchedule: (id: string) => Promise<boolean>;
};
