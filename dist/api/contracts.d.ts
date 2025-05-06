import { BrowserContext, Page } from "playwright-core";
interface Params {
}
interface BidItem {
    title: string;
    signal_source_unique_id: string;
    due_date: string | null;
    details_url_for_item: string | null;
    attachments: Attachment[];
    source_url?: string;
}
interface Attachment {
    filename: string;
    key?: string;
    suggested_filename?: string;
}
export default function handler(params: Params, _playwrightPage: Page, context: BrowserContext): Promise<BidItem[]>;
export {};
