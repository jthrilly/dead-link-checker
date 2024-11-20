#!/usr/bin/env node

import readline from "node:readline";
import { setTimeout } from "node:timers/promises";
import { URL } from "node:url";
import { JSDOM } from "jsdom";

const deadLinks = [];
const visited = new Set();
const queuedLinks = new Set();
const checkedLinks = [];
let checked = 0;
let totalLinks = 0;
let isProcessing = true;

// Create a queue for processing links
const queue = [];

/**
 * Fetches and validates all links on a page.
 * @param {string} url - The URL of the page to check.
 * @param {string} origin - The origin of the initial page.
 */
async function checkLinks(url, origin) {
	if (visited.has(url)) return;
	visited.add(url);

	try {
		const response = await fetch(url, { redirect: "manual" });
		checked++;
		updateStatus();

		checkedLinks.push({ url, status: response.status });

		if (response.status >= 400) {
			deadLinks.push({ url, status: response.status });
			return;
		}

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location) {
				deadLinks.push({
					url,
					status: response.status,
					error: "Redirect with no Location header",
				});
				return;
			}
			const redirectURL = new URL(location, url).href;
			if (!queuedLinks.has(redirectURL)) {
				queue.push(() => checkLinks(redirectURL, origin));
				queuedLinks.add(redirectURL);
				totalLinks++;
			}
			return;
		}

		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("text/html")) return;

		const html = await response.text();
		const dom = new JSDOM(html);

		const links = Array.from(dom.window.document.querySelectorAll("a")).reduce(
			(acc, link) => {
				try {
					const href = link.getAttribute("href")?.trim() || "";
					if (
						href &&
						!href.startsWith("mailto:") &&
						!href.startsWith("javascript:") &&
						!href.startsWith("#") &&
						href !== "about:blank"
					) {
						const resolvedLink = new URL(href.split("#")[0], url).href;
						const normalizedLink = resolvedLink.endsWith("/")
							? resolvedLink.slice(0, -1)
							: resolvedLink;
						acc.push(normalizedLink);
					}
				} catch {
					// Ignore invalid URLs
				}
				return acc;
			},
			[],
		);

		for (const link of links) {
			if (!queuedLinks.has(link)) {
				queuedLinks.add(link);

				const linkURL = new URL(link);
				if (linkURL.origin === origin) {
					// Internal link: Add to the queue for recursion
					queue.push(() => checkLinks(link, origin));
					totalLinks++;
				} else {
					// External link: Check only this link (no recursion)
					queue.push(async () => {
						try {
							const response = await fetch(link, { redirect: "manual" });
							checked++;
							updateStatus();

							checkedLinks.push({ url: link, status: response.status });

							if (response.status >= 400) {
								deadLinks.push({ url: link, status: response.status });
							}
						} catch (error) {
							deadLinks.push({
								url: link,
								status: "FETCH_ERROR",
								error: error.message,
							});
						}
					});
					totalLinks++;
				}
			}
		}
	} catch (error) {
		checkedLinks.push({ url, status: "FETCH_ERROR", error: error.message });
		deadLinks.push({ url, status: "FETCH_ERROR", error: error.message });
	}
}

/**
 * Processes the queue with concurrent requests.
 * @param {number} concurrentRequests - Number of concurrent requests.
 * @param {number} delay - Delay between requests in milliseconds.
 */
async function processQueue(concurrentRequests, delay) {
	const workers = Array.from({ length: concurrentRequests }, async () => {
		while (queue.length > 0) {
			const task = queue.shift();
			if (task) await task();
			await setTimeout(delay); // Avoid overloading servers
		}
	});

	await Promise.all(workers);
	isProcessing = false;
}

/**
 * Updates the console status line.
 */
function updateStatus() {
	readline.cursorTo(process.stdout, 0);
	const loadingIndicator = isProcessing ? "⏳" : "";
	const statusText = `Checked: ${checked}/${totalLinks} links`;
	process.stdout.write(`${loadingIndicator} ${statusText}`);
}

/**
 * Prints a verbose summary of all checked links.
 */
function printVerboseSummary() {
	console.log("\nSummary of checked links:");
	for (const { url, status, error } of checkedLinks) {
		const statusText = error ? `FETCH_ERROR (${error})` : status.toString();
		console.log(`- ${url} (Status: ${statusText})`);
	}
}

/**
 * Main function to initiate the link checking.
 */
async function main() {
	const args = process.argv.slice(2);
	const inputURL = args.find((arg) => !arg.startsWith("-"));
	const verbose = args.includes("-v");
	const concurrentRequests = Number.parseInt(
		args.find((arg) => arg.startsWith("--concurrent="))?.split("=")[1] || "25",
		10,
	);
	const delay = Number.parseInt(
		args.find((arg) => arg.startsWith("--delay="))?.split("=")[1] || "10",
		10,
	);

	if (!inputURL) {
		console.error(
			"Usage: node dead-link-checker.js <URL> [-v] [--concurrent=<number>] [--delay=<milliseconds>]",
		);
		process.exit(1);
	}

	const { origin } = new URL(inputURL);
	console.log(`Starting to check links on: ${inputURL}\n`);
	queue.push(() => checkLinks(inputURL, origin));
	queuedLinks.add(inputURL);
	totalLinks++;

	updateStatus();
	await processQueue(concurrentRequests, delay);

	console.log("\n"); // Move to a new line after progress

	if (verbose) {
		printVerboseSummary();
	}

	if (deadLinks.length === 0) {
		console.log("\x1b[32m✅ No dead links found.\x1b[0m");
		process.exit(0);
	} else {
		console.error("\x1b[31m❌ Dead links found:\x1b[0m");
		for (const { url, status, error } of deadLinks) {
			console.error(
				`- ${url} (Status: ${status}${error ? `, Error: ${error}` : ""})`,
			);
		}
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("An unexpected error occurred:", err);
	process.exit(1);
});
