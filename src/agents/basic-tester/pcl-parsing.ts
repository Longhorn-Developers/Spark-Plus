type ReservationData = {
	time: Date;
	room: string;
	availability: "available" | "unavailable";
};

function getReservationDataFromAriaLabel(ariaLabel: string) {
	// Example ariaLabel:
	// "4:00pm Monday, March 2, 2026 - PCL 4.106 - Unavailable/Padding"
	const regex =
		/^(\d{1,2}:\d{2}(am|pm)) ([^,]+), ([^,]+), (\d{4}) - ([^-]+) - ([^\/]+)\/?.*$/i;
	const match = ariaLabel.match(regex);

	if (!match) {
		console.error(`Invalid ariaLabel format: "${ariaLabel}"`);
		return null;
	}

	const [, timeStr, ampm, weekday, monthDay, year, roomRaw, availabilityRaw] =
		match;

	const dateString = `${timeStr} ${ampm} ${monthDay}, ${year}`;
	const parsedDate = new Date(
		`${monthDay}, ${year} ${timeStr} ${ampm.toUpperCase()}`,
	);
	if (isNaN(parsedDate.getTime())) {
		console.error(`Failed to parse date in ariaLabel: "${ariaLabel}"`);
		return null;
	}

	const room = roomRaw.trim();
	const availability = availabilityRaw
		.trim()
		.toLowerCase()
		.startsWith("unavail")
		? "unavailable"
		: "available";

	return {
		time: parsedDate,
		room,
		availability,
	} as ReservationData;
}

export async function test() {
	return "test";
}

// export async function test() {
// 	const response = await fetch(
// 		"https://libcal.lib.utexas.edu/spaces?lid=16542&gid=35011",
// 	);
// 	const text = await response.text();
// 	const { document } = parseHTML(text);

// 	// const aTags = document.querySelectorAll("a[aria-label][title]");
// 	const aTags = document.querySelectorAll("a[title]");
// 	if (!aTags) {
// 		throw new Error("a tags not found");
// 	}

// 	console.log("A TAGS:", aTags);
// 	const data: Record<number, ReservationData> = {};
// 	aTags.forEach((aTag: Element) => {
// 		const ariaLabel = aTag.getAttribute("aria-label");
// 		const title = aTag.getAttribute("title");
// 		if (!ariaLabel || !title) {
// 			throw new Error("aria-label or title not found");
// 		}
// 		const reservationData = getReservationDataFromAriaLabel(ariaLabel);
// 		if (!reservationData) return;
// 		data[reservationData.time.getTime()] = reservationData;
// 	});

// 	return data;
// }
