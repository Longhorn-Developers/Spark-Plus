import { parseHTML } from "linkedom";

const BASE = "https://experts.utexas.edu";
const RESULTS_URL = `${BASE}/search/results`;
const REFERER = `${BASE}/search/`;

function parseArgs(argv) {
	const out = { pretty: false, keyword: null, school: null, lastname: null };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--pretty") {
			out.pretty = true;
			continue;
		}
		if (a === "--keyword" || a === "--school" || a === "--lastname") {
			const v = argv[i + 1];
			if (v == null || v.startsWith("--")) {
				console.error(`Missing value for ${a}`);
				process.exit(1);
			}
			i++;
			if (a === "--keyword") out.keyword = v;
			else if (a === "--school") out.school = v;
			else out.lastname = v;
			continue;
		}
		if (a === "-h" || a === "--help") {
			printHelp();
			process.exit(0);
		}
		console.error(`Unknown argument: ${a}`);
		printHelp();
		process.exit(1);
	}
	const modes = [out.keyword, out.school, out.lastname].filter(Boolean);
	if (modes.length !== 1) {
		console.error("Provide exactly one of: --keyword, --school, --lastname");
		printHelp();
		process.exit(1);
	}
	return out;
}

function printHelp() {
	console.error(`Usage: node scripts/utexas-experts-search.mjs (--keyword TEXT | --school TEXT | --lastname TEXT) [--pretty]

  --keyword   Keyword search (same as site "Keyword(s)" field)
  --school    Exact label from the College/School dropdown (e.g. "College of Natural Sciences")
  --lastname  Last name search (same as site "Name" field)
  --pretty    Pretty-print JSON`);
}

function buildRequest(args) {
	const body = new URLSearchParams();
	let type;
	let value;
	if (args.keyword != null) {
		type = "keyword";
		value = args.keyword;
		body.set("keyword", args.keyword);
		body.set("go_keyword", "Search");
	} else if (args.school != null) {
		type = "school";
		value = args.school;
		body.set("school", args.school);
		body.set("go_school", "Search");
	} else {
		type = "lastname";
		value = args.lastname;
		body.set("lastname", args.lastname);
		body.set("go_lastname", "Search");
	}
	return { type, value, body };
}

function isNoResultsHtml(html) {
	return (
		html.includes("We were unable to find a suitable match") ||
		html.includes("No results found.")
	);
}

function parseResearchers(document) {
	const units = document.querySelectorAll(".promo-field.promo-unit");
	const researchers = [];
	for (const unit of units) {
		const head = unit.querySelector("a.headline-link");
		const img = unit.querySelector("img.promo-image");
		const copyP = unit.querySelector("div.promo-copy p");
		if (!head) continue;

		const path = head.getAttribute("href") || "";
		const name = (head.textContent || "").trim();
		const imageUrl = img?.getAttribute("src")?.trim() || null;
		const alt = img?.getAttribute("alt")?.trim() || null;

		let title = null;
		let email = null;
		let phone = null;
		let expertise = null;

		if (copyP) {
			const strong = copyP.querySelector("strong");
			if (strong) title = (strong.textContent || "").trim();

			const mail = copyP.querySelector('a[href^="mailto:"]');
			if (mail) {
				const href = mail.getAttribute("href") || "";
				email =
					decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0] || "").trim() ||
					null;
			}

			const fullText = (copyP.textContent || "").replace(/\s+/g, " ").trim();
			const phoneMatch = fullText.match(/\+1\s*\d{3}\s*\d{3}\s*\d{4}/);
			if (phoneMatch) phone = phoneMatch[0].replace(/\s+/g, " ");

			const expIdx = fullText.search(/Expertise:\s*/i);
			if (expIdx >= 0) {
				expertise = fullText.slice(expIdx + "Expertise:".length).trim();
			}
		}

		researchers.push({
			name: name || alt,
			path,
			url: path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`,
			imageUrl,
			title,
			email,
			phone,
			expertise,
		});
	}
	return researchers;
}

async function main() {
	const args = parseArgs(process.argv);
	const { type, value, body } = buildRequest(args);

	const res = await fetch(RESULTS_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Referer: REFERER,
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		},
		body: body.toString(),
	});

	const html = await res.text();
	if (!res.ok) {
		console.error(`HTTP ${res.status} ${res.statusText}`);
		process.exit(1);
	}

	const { document } = parseHTML(html);
	const researchers = parseResearchers(document);
	const noResults = researchers.length === 0 && isNoResultsHtml(html);

	const payload = {
		source: RESULTS_URL,
		query: { type, value },
		count: researchers.length,
		noResults,
		researchers,
	};

	const json = args.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
	process.stdout.write(`${json}\n`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
