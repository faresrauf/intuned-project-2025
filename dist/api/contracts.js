"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const playwright_1 = require("@intuned/sdk/playwright");
const runtime_1 = require("@intuned/sdk/runtime");
const helper_1 = require("../utils/helper");
async function extractBids(page) {
    const results = [];
    // Get all bid item containers
    const bidItems = await page.locator("div.post-wrapper").all();
    for (const item of bidItems) {
        try {
            // Get the title/bid number text
            const titleElement = item.locator("h3.title a");
            if (await titleElement.count() === 0) {
                continue;
            }
            let fullText = await titleElement.textContent() || '';
            // Remove "Read More" text which appears at the end
            fullText = fullText.replace("Read More", "").trim();
            // Get the href attribute for the details URL
            const href = await titleElement.getAttribute("href") || "";
            const detailsUrl = href ? `https://etowahcounty.org/department/purchasing/${href}` : null;
            // Parse out bid number and title
            const title = fullText;
            let bidNumber = null;
            // Extract bid number using regex pattern matching
            // Pattern 1: Regular fiscal year bids like "BID NO FY 2025-11"
            let match = fullText.match(/BID NO\.?\s*(?:FY\s*)?(\d{4}-\d{1,2})/i);
            if (match) {
                bidNumber = `FY ${match[1]}`;
            }
            // Pattern 2: Fiscal year spans like "2021-2022-23"
            if (!bidNumber) {
                match = fullText.match(/(\d{4})-\d{4}-(\d{1,2})/);
                if (match) {
                    const year = match[1];
                    const sequence = match[2];
                    bidNumber = `FY ${year}-${sequence}`;
                }
            }
            // Pattern 3: Fiscal year identifiers like "FY 2023-08"
            if (!bidNumber) {
                match = fullText.match(/FY\s*(\d{4}-\d{1,2})/i);
                if (match) {
                    bidNumber = `FY ${match[1]}`;
                }
            }
            // Skip items where we couldn't extract a bid number
            if (!bidNumber) {
                continue;
            }
            // Extract attachments
            const attachments = [];
            // Find all attachment links
            const attachmentTitles = await item.locator("div.attachments div.attachment-title a").all();
            for (const attachmentTitle of attachmentTitles) {
                try {
                    // Get the URL and text
                    const attachmentUrl = await attachmentTitle.getAttribute("href");
                    if (!attachmentUrl) {
                        continue;
                    }
                    // Get the filename from the URL
                    const urlFilename = attachmentUrl.split("/").pop() || 'unknown_file';
                    attachments.push({
                        filename: urlFilename,
                        suggested_filename: urlFilename
                    });
                }
                catch (e) {
                    console.error(`Error processing attachment: ${e}`);
                    continue;
                }
            }
            results.push({
                title,
                signal_source_unique_id: bidNumber,
                due_date: null, // No due date found in the examples
                details_url_for_item: detailsUrl,
                attachments
            });
        }
        catch (e) {
            console.error(`Error processing bid item: ${e}`);
            continue;
        }
    }
    // Remove duplicates while preserving order
    const seen = new Set();
    const uniqueResults = [];
    for (const item of results) {
        // Include attachments info in deduplication key
        const attachmentsKey = item.attachments.map(att => `${att.filename}:${att.suggested_filename || ''}`).join('|');
        const itemKey = [
            item.title,
            item.signal_source_unique_id,
            item.due_date,
            item.details_url_for_item,
            attachmentsKey
        ].join('::');
        if (!seen.has(itemKey)) {
            seen.add(itemKey);
            uniqueResults.push(item);
        }
    }
    return uniqueResults;
}
async function handler(params, _playwrightPage, context) {
    const page = (0, playwright_1.extendPlaywrightPage)(_playwrightPage);
    (0, helper_1.help)();
    // Navigate to the Etowah County purchasing page
    await page.goto("https://etowahcounty.org/department/purchasing/");
    // Click on the bids link
    try {
        await page.click("html body main section div div div article div div div div div a");
        await page.waitForLoadState('networkidle');
    }
    catch (e) {
        console.error("Failed to click on bids link: ", e);
    }
    // Extract bid data
    const results = await extractBids(page);
    // Schedule API calls for detailed pages
    results.forEach((bid) => {
        if (bid.details_url_for_item) {
            (0, runtime_1.extendPayload)({
                api: "bid-details",
                parameters: {
                    bidFullUrl: bid.details_url_for_item,
                    signal_source_unique_id: bid.signal_source_unique_id
                },
            });
        }
    });
    return results;
}
