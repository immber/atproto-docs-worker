import puppeteer from "@cloudflare/puppeteer";
import { resources } from "./resources";

import type { Browser } from "@cloudflare/puppeteer";

interface Env {
	MY_BROWSER: any;
	CRAWLER_QUEUE: Queue<Message>;
	ATPROTO_DOCS: R2Bucket;
}

type Message = {
	url: string;
  };

async function enqueueMessage(msg:Message, env:Env) {
	await env.CRAWLER_QUEUE.send(msg);
}

async function queueHandler(batch: MessageBatch<Message>, env: Env): Promise<void> {
	let browser: Browser | null = null;
	try {
		browser = await puppeteer.launch(env.MY_BROWSER);
	} catch {
		batch.retryAll();
		return;
	}
	for (const message of batch.messages) {
		try {
			const url = message.body.url;
			await crawlAndSaveContent(browser, url, env);
			message.ack();
		} catch {
			message.retry();
		}
	}
	await browser.close();
}

// crawls a single url at a time and saves content to R2
async function crawlAndSaveContent(browser:any, url:string, env:Env) {
	//pull content
	const page = await browser.newPage();
	await page.goto(url, {waitUntil: "load"});
	//save it
	const key = url + ".html";
	const content = await page.content();
	await env.ATPROTO_DOCS.put(key, content);
	console.log(`saved ${key}`);

	// now find path links and queue them
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
	const urls: MessageSendRequest<Message>[] = paths.map((path) => {
		return {
		  body: {
			url: path,
		  },
		};
	});
	try {
		await env.CRAWLER_QUEUE.sendBatch(urls);
	} catch {}
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

		for (const url of resources) {
			//list of links enters queue for crawling
			await enqueueMessage({url:url}, env);
		}
		console.log(`queued ${resources.length} resources`);
	},

	// consume the queue with the urls to crawl
	async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
		await queueHandler(batch, env);
	}

} satisfies ExportedHandler<Env>;
