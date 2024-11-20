
# Dead Link Checker

A simple and efficient Node.js script to recursively check for dead links on a webpage. This script validates both internal and external links, with configurable concurrency and delay to control the load on servers.

## Features

- **Recursive Link Checking**: Crawls and checks all links on the given webpage, including internal and external links.
- **Concurrency Control**: Configure the number of simultaneous requests for faster or slower processing.
- **Delay Between Requests**: Add delays between requests to avoid overwhelming servers.
- **Verbose Output**: View detailed information about each link checked.
- **Excludes Non-HTTP Links**: Skips invalid URLs like `mailto:`, `javascript:`, and fragment links (`#section`).

## Requirements

- Node.js 20.x or later

## Installation

No need to install - just call directly from your github action or CLI using npx:

```bash
npx dead-link-checker <URL> [options]
```

### Options

- `-v`: Enable verbose mode. Displays all checked links and their status codes.
- `--concurrent=<number>`: Set the number of concurrent requests (default: 20).
- `--delay=<milliseconds>`: Set the delay between requests in milliseconds (default: 10).

## Excluded Links

The script skips the following types of links:
- `mailto:` email links
- `javascript:` links
- Empty links (`<a href=""></a>`)
- Fragment-only links (`<a href="#section"></a>`)

## How It Works

1. The script fetches the provided URL and parses all links using the `JSDOM` library.
2. Each link is validated using the Node.js `fetch` API.
3. Internal links are recursively added to the queue for further checking.
4. External links are checked only once and not followed recursively.
5. Links with errors (e.g., `404 Not Found`) are reported in the summary.

## License

This script is released under the MIT License. Feel free to modify and use it as you see fit.

## Author

Developed by Joshua Melville (jthrilly) using Claude and ChatGPT.
