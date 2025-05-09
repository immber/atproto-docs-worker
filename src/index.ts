import puppeteer from "@cloudflare/puppeteer";
import { resources } from "./resources";

interface Env {
	MY_BROWSER: any;
	ATPROTO_DOCS: R2Bucket;
}
//TODO: should this be a queue, yep, but for now its just this
async function pullAndSaveContent(browser:any, url:string, env:Env) {
	//pull content
	const page = await browser.newPage();
	await page.goto(url, {waitUntil: "load"});
	//save it
	const key = url + ".html";
	const content = await page.content();
	await env.ATPROTO_DOCS.put(key, content);

	// now recursivly find path links and crawl them
	const hrefs = await page.$$eval("a", (links:Array<any>) => {
		return links.map(link => link.href)
		});
	// filter paths to remove duplicates and skip parent pages or links including #
	let paths:Array<string> = []
	let filtered:Set<string> = new Set(hrefs);
	for (const href of filtered) {
		if (href.includes(url) && !href.includes("#") && !(href === url)) {
			paths.push(href);
		}
	}
	for (const path of paths) {
		await pullAndSaveContent(browser, path, env);
	}
	await page.close();
	return ;
}

export default {
	async fetch(req) {
		const url = new URL(req.url);
		url.pathname = '/__scheduled';
		url.searchParams.append('cron', '* * * * *');
		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {

		const browser = await puppeteer.launch(env.MY_BROWSER);

		for (const url of resources) {
			await pullAndSaveContent(browser, url as string, env);
		}
		await browser.close();
		console.log(`success`);
		// A Cron Trigger can make requests to other endpoints on the Internet,
		// publish to a Queue, query a D1 Database, and much more.
		//
		// We'll keep it simple and make an API call to a Cloudflare API:
		// let resp = await fetch('https://api.cloudflare.com/client/v4/ips');
		// let wasSuccessful = resp.ok ? 'success' : 'fail';

		// You could store this result in KV, write to a D1 Database, or publish to a Queue.
		// In this template, we'll just log the result:
		// console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);
	},
} satisfies ExportedHandler<Env>;
