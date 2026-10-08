# Brief: national chapter and club finders (lane P)

Your brief lists national organizations that publish chapter or club finders. For each one, find the
Philadelphia chapters, clubs or units (within the city, plus ones just outside that clearly serve
city residents), using the organization's own finder or chapter list page (WebFetch). Use WebSearch
only when the finder is missing or broken, within your budget.

For each chapter found, check its own page if it has one (WebFetch once) and write a tier 1 record
per `_common.md`. If the national finder is the only source, write the record with the finder as the
source, `confidence: "low"`, and status from any dated item you can see (else `unknown`).
Leave `match.lead_ids` empty and set `match.website` when known.

Finders that need a login, a form submission, or that sit behind a bot check: record them in
`blocked` and move on. Do not type addresses or ZIPs into search forms; if a finder only works by
form, note it as blocked. Plain URL query strings you can see in a public link are fine.
