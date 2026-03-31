import type { GrantSourceConfig } from "./types";

export const DEFAULT_REFRESH_INTERVAL_SECONDS = 60 * 60 * 6; // 6 hours
export const SNAPSHOT_MONTHLY_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const DEFAULT_STALE_AFTER_MS = SNAPSHOT_MONTHLY_TTL_MS;
export const DEFAULT_MIN_OPEN_SCORE = 50;
export const DEFAULT_MAX_RESULTS = 50;
export const ABSOLUTE_MAX_RESULTS = 200;
export const ABSOLUTE_MAX_PAGES_PER_SOURCE = 15;
export const FIRECRAWL_PAGE_BUDGET_TOTAL = 500; // lifetime cap
export const FIRECRAWL_MIN_PAGES_TO_REFRESH = 2;
export const EARLY_REFRESH_MIN_DAYS_SINCE_LAST = 14; // conservative profile
export const EARLY_REFRESH_MAX_PAGES_PER_RUN = 2; // conservative profile
export const DEFAULT_MAX_PAGES_PER_RUN = 8;

export const GRANT_SOURCES: GrantSourceConfig[] = [
	{
		id: "nih-guide",
		name: "NIH Grants Guide",
		base_url: "https://grants.nih.gov/",
		entry_url: "https://grants.nih.gov/funding/searchGuide",
		strategy: "scrape",
	},
	{
		id: "nsf-funding",
		name: "NSF Active Funding",
		base_url: "https://www.nsf.gov/",
		entry_url: "https://www.nsf.gov/funding/opportunities",
		strategy: "scrape",
	},
	{
		id: "doe-science",
		name: "DOE Office of Science",
		base_url: "https://science.osti.gov/",
		entry_url: "https://science.osti.gov/Funding-Opportunities",
		strategy: "scrape",
	},
	{
		id: "nifa-usda",
		name: "USDA NIFA Funding Opportunities",
		base_url: "https://www.nifa.usda.gov/",
		entry_url: "https://www.nifa.usda.gov/grants/funding-opportunities",
		strategy: "scrape",
	},
	{
		id: "darpa-opportunities",
		name: "DARPA Opportunities",
		base_url: "https://www.darpa.mil/",
		entry_url: "https://www.darpa.mil/work-with-us/opportunities",
		strategy: "scrape",
	},
];
