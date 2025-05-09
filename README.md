# Scraping atproto docs for RAG Indexing
### A CloudFlare worker running weekly on a cron schedule

This worker crawls the sites listed in `src/resources` to scrape content for building a RAG index.

HTML files are stored in an R2 storage bucket and indexed by a CloudFlare AutoRAG instance.


## Based on Cloudflare cron worker template

 This is a template for a Scheduled Worker: a Worker that can run on a
 configurable interval:
 https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/

Learn more at https://developers.cloudflare.com/workers/

## MCP server for atproto docs

This worker fees the vecotorize index used by [mcp-atproto-docs](https://github.com/immber/mcp-atproto-docs) a remote MCP server publicly available at:
```
https://mcp-atproto-docs.immber.workers.dev/sse
```

You can use the `search_documentation` tool to query ATprocol's public documentation.

For usage instructions see https://github.com/immber/mcp-atproto-docs


