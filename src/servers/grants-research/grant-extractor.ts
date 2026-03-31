import type {
	FirecrawlPage,
	GrantCandidate,
	GrantRecord,
	GrantSourceConfig,
} from "./types";

const DISCOVERY_KEYWORDS = [
	"grant",
	"funding",
	"opportunity",
	"apply",
	"application",
	"call for proposals",
	"deadline",
	"rfa",
	"rfp",
	"investigator",
	"solicitation",
	"announcement",
	"nofo",
	"foa",
	"award",
];

const MARKDOWN_LINK_REGEX = /\[([^\]]{12,})\]\((https?:\/\/[^\s)]+)\)/g;
const LISTING_SIGNAL_REGEX =
	/\b(deadline|closing date|close date|apply by|applications close|applications due|announcement number|post date|open date|award ceiling|letter of intent|pre-application|pre-application required|solicitation|foa|nofo)\b/i;
const META_CONTENT_REGEX =
	/\b(how to|guide to|tips for|frequently asked questions|faq|webinar|workshop|technical assistance|eligibility guide|proposal guide|how to write)\b/i;

const POSITIVE_SIGNALS: Array<{ pattern: RegExp; score: number; reason: string }> = [
	{ pattern: /\bopen\b/i, score: 15, reason: "contains_open" },
	{ pattern: /\bnow accepting\b/i, score: 20, reason: "contains_now_accepting" },
	{ pattern: /\bapply\b/i, score: 10, reason: "contains_apply" },
	{ pattern: /\bdeadline\b/i, score: 10, reason: "contains_deadline" },
	{
		pattern: /\bfunding opportunity\b|\bgrant opportunity\b/i,
		score: 12,
		reason: "contains_opportunity_language",
	},
	{
		pattern: /\bannouncement number\b|\bsolicitation\b|\bfoa\b|\bnofo\b/i,
		score: 10,
		reason: "contains_listing_metadata",
	},
];

const NEGATIVE_SIGNALS: Array<{ pattern: RegExp; score: number; reason: string }> = [
	{ pattern: /\bclosed\b/i, score: -30, reason: "contains_closed" },
	{ pattern: /\bexpired\b/i, score: -30, reason: "contains_expired" },
	{ pattern: /\barchived\b/i, score: -25, reason: "contains_archived" },
	{ pattern: /\bpast deadline\b/i, score: -30, reason: "contains_past_deadline" },
	{
		pattern: /\baward announced\b|\bawarded\b/i,
		score: -10,
		reason: "contains_award_announced",
	},
];

export function extract_grant_candidates(
	source: GrantSourceConfig,
	pages: FirecrawlPage[],
): GrantCandidate[] {
	const candidates: GrantCandidate[] = [];

	for (const page of pages) {
		const page_candidates = extract_page_candidates(source, page);
		candidates.push(...page_candidates);
	}

	return dedupe_candidates(candidates);
}

export function score_candidates(
	candidates: GrantCandidate[],
	fetched_at: string,
): GrantRecord[] {
	return candidates
		.map((candidate) => {
			const { score, reasons } = score_candidate(candidate);
			return {
				id: make_stable_id(`${candidate.url}|${candidate.title}`),
				source_id: candidate.source_id,
				source_name: candidate.source_name,
				source_url: candidate.source_url,
				url: candidate.url,
				title: candidate.title,
				excerpt: candidate.excerpt,
				deadline_text: candidate.deadline_text,
				open_score: score,
				is_likely_open: score >= 50,
				reasons,
				fetched_at,
			} satisfies GrantRecord;
		})
		.sort((a, b) => b.open_score - a.open_score);
}

function extract_page_candidates(
	source: GrantSourceConfig,
	page: FirecrawlPage,
): GrantCandidate[] {
	const markdown = page.markdown ?? "";
	const lines = markdown.split("\n");
	const extracted = [
		...extract_markdown_link_candidates(source, lines),
		...extract_heading_candidates(source, page, lines),
	];

	if (extracted.length === 0) {
		const fallback_text = `${page.title ?? ""}\n${markdown.slice(0, 1400)}`.trim();
		if (
			contains_discovery_keyword(fallback_text) &&
			contains_grant_listing_signal(fallback_text) &&
			!is_meta_content(fallback_text)
		) {
			extracted.push({
				source_id: source.id,
				source_name: source.name,
				source_url: source.base_url,
				url: page.url,
				title: page.title ?? "Untitled grant listing",
				excerpt: compress_whitespace(markdown.slice(0, 600)),
				raw_text: fallback_text,
				deadline_text: extract_deadline_text(fallback_text),
			});
		}
	}

	return extracted;
}

function extract_markdown_link_candidates(
	source: GrantSourceConfig,
	lines: string[],
): GrantCandidate[] {
	const extracted: GrantCandidate[] = [];

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		const matches = line.matchAll(MARKDOWN_LINK_REGEX);

		for (const match of matches) {
			const title = compress_whitespace(match[1] ?? "");
			const url = sanitize_url(match[2] ?? "");
			const context = collect_context_window(lines, index, 3, 5);
			const raw_text = `${title}\n${context}`.trim();
			if (!contains_discovery_keyword(raw_text)) continue;
			if (is_meta_content(raw_text)) continue;
			if (!contains_grant_listing_signal(raw_text) && !contains_discovery_keyword(title))
				continue;

			extracted.push({
				source_id: source.id,
				source_name: source.name,
				source_url: source.base_url,
				url,
				title,
				excerpt: context,
				raw_text,
				deadline_text: extract_deadline_text(raw_text),
			});
		}
	}

	return extracted;
}

function extract_heading_candidates(
	source: GrantSourceConfig,
	page: FirecrawlPage,
	lines: string[],
): GrantCandidate[] {
	const extracted: GrantCandidate[] = [];

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]?.trim() ?? "";
		if (!line.startsWith("#")) continue;

		const heading = compress_whitespace(line.replace(/^#+\s*/, ""));
		const snippet = collect_snippet(lines, index + 1, 6);
		const raw_text = `${heading}\n${snippet}`.trim();
		if (!contains_discovery_keyword(raw_text)) continue;
		if (!contains_grant_listing_signal(raw_text)) continue;
		if (is_meta_content(raw_text)) continue;

		extracted.push({
			source_id: source.id,
			source_name: source.name,
			source_url: source.base_url,
			url: extract_first_url(raw_text) ?? page.url,
			title: heading,
			excerpt: snippet,
			raw_text,
			deadline_text: extract_deadline_text(raw_text),
		});
	}

	return extracted;
}

function score_candidate(candidate: GrantCandidate): {
	score: number;
	reasons: string[];
} {
	let score = 40;
	const reasons: string[] = [];
	const text = `${candidate.title}\n${candidate.excerpt}\n${candidate.raw_text}`;

	for (const signal of POSITIVE_SIGNALS) {
		if (!signal.pattern.test(text)) continue;
		score += signal.score;
		reasons.push(signal.reason);
	}

	for (const signal of NEGATIVE_SIGNALS) {
		if (!signal.pattern.test(text)) continue;
		score += signal.score;
		reasons.push(signal.reason);
	}

	const deadline = extract_deadline_date(text);
	if (deadline) {
		const today = new Date();
		if (deadline.getTime() >= today.getTime()) {
			score += 15;
			reasons.push("deadline_in_future");
		} else {
			score -= 25;
			reasons.push("deadline_in_past");
		}
	}

	return {
		score: clamp(score, 0, 100),
		reasons: reasons.length > 0 ? reasons : ["insufficient_signals"],
	};
}

function extract_deadline_text(text: string): string | undefined {
	const line_match = text.match(
		/\b(deadline|closing date|close date|apply by|applications close|applications due)\b[^\n]*/i,
	);
	if (line_match) return compress_whitespace(line_match[0]).slice(0, 180);
	const date_match = text.match(
		/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
	);
	if (date_match) return date_match[0];
	return undefined;
}

function extract_deadline_date(text: string): Date | undefined {
	const month_date = text.match(
		/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
	);
	if (month_date) {
		const parsed = new Date(month_date[0]);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}

	const numeric_date = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
	if (!numeric_date) return undefined;
	const parsed = new Date(numeric_date[0]);
	if (!Number.isNaN(parsed.getTime())) return parsed;
	return undefined;
}

function dedupe_candidates(candidates: GrantCandidate[]): GrantCandidate[] {
	const seen = new Set<string>();
	const unique: GrantCandidate[] = [];

	for (const candidate of candidates) {
		const normalized_url = sanitize_url(candidate.url);
		const key = `${normalized_url}|${normalize_text(candidate.title)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push({
			...candidate,
			url: normalized_url,
			title: candidate.title.trim(),
			excerpt: compress_whitespace(candidate.excerpt).slice(0, 600),
			raw_text: candidate.raw_text.slice(0, 1800),
		});
	}

	return unique;
}

function contains_discovery_keyword(text: string): boolean {
	const normalized = normalize_text(text);
	return DISCOVERY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function contains_grant_listing_signal(text: string): boolean {
	return LISTING_SIGNAL_REGEX.test(text);
}

function is_meta_content(text: string): boolean {
	return META_CONTENT_REGEX.test(text);
}

function collect_context_window(
	lines: string[],
	index: number,
	before_lines: number,
	after_lines: number,
): string {
	const start = Math.max(0, index - before_lines);
	const end = Math.min(lines.length, index + after_lines + 1);
	return compress_whitespace(lines.slice(start, end).join(" ")).slice(0, 600);
}

function collect_snippet(lines: string[], start_index: number, max_lines: number): string {
	const snippet_lines: string[] = [];
	for (let index = start_index; index < lines.length; index++) {
		const line = lines[index]?.trim() ?? "";
		if (line.length === 0) continue;
		if (line.startsWith("#")) break;
		snippet_lines.push(line);
		if (snippet_lines.length >= max_lines) break;
	}
	return compress_whitespace(snippet_lines.join(" ")).slice(0, 500);
}

function make_stable_id(seed: string): string {
	let hash = 0;
	for (let index = 0; index < seed.length; index++) {
		hash = (hash * 31 + seed.charCodeAt(index)) | 0;
	}
	return `grant_${Math.abs(hash).toString(16)}`;
}

function normalize_text(value: string): string {
	return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compress_whitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function extract_first_url(text: string): string | undefined {
	const markdown_match = text.match(MARKDOWN_LINK_REGEX);
	if (markdown_match) {
		const markdown_url_match = markdown_match[0]?.match(/\((https?:\/\/[^\s)]+)\)/);
		if (markdown_url_match?.[1]) return sanitize_url(markdown_url_match[1]);
	}

	const url_match = text.match(/https?:\/\/[^\s)]+/);
	if (!url_match?.[0]) return undefined;
	return sanitize_url(url_match[0]);
}

function sanitize_url(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return url;
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
