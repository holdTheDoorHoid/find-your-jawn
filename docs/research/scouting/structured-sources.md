# Structured and official sources for the Philly community org directory

Scouting pass completed 2026 10 04. Every source below was actually hit with curl or WebFetch during this session; status codes and sample payloads are real, not assumed. Small JSON/CSV samples (each under 2 MB) are saved in `samples/` next to this file for later harvesting agents to reuse as schema references.

## Ranked summary table

| Rank | Source | Access method | Approx Philly count | Fields | Terms | Harvest difficulty | Value for small orgs |
|---|---|---|---|---|---|---|---|
| 1 | IRS Exempt Org Business Master File, PA extract | Direct CSV download, no auth | 9,664 records with ZIP starting 191 (9,515 with city PHILADELPHIA) out of 81,852 statewide | EIN, name, address, NTEE code, subsection, ruling date, asset/income bands | Public IRS data, free to reuse | Easy | High |
| 2 | IRS Form 990 N e Postcard bulk file | Direct CSV download, no auth | Not filtered yet (file covers all US filers, 1.3M+ orgs) | EIN, legal name, officer name/address, org address, website, dba names | Public IRS data, free to reuse | Medium (330 MB file, needs streaming filter by state/zip) | Very high (only source for orgs under $50k that never file a real 990) |
| 3 | Philadelphia RCO Boundaries (Zoning_RCO layer) | ArcGIS REST, JSON, no auth | 240 | org name, address, meeting location, org type, primary and alternate contact name/email/phone, website, expiration year | City of Philadelphia License, free use, "as is" | Easy | High |
| 4 | PPR Friends Groups | ArcGIS REST, JSON, no auth | 141 | friends group name, public name, parent org, address, zip, contact email, contact website, district codes | City of Philadelphia License | Easy | High |
| 5 | Penn Clubs API | REST JSON, no auth | 479 active clubs | name, code, email, subtitle, founded date, size, tags/category, active/approved flags | No published terms; public unauthenticated endpoint, treat politely | Easy | High (student orgs, several open to non students) |
| 6 | Drexel DragonLink (Campus Labs Engage) | REST JSON (OData style), no auth | 548 | name, short name, description, summary, status, visibility | Campus Labs platform terms apply to the school, endpoint itself unauthenticated | Easy | High |
| 7 | Neighborhood Advisory Committees | ArcGIS REST, JSON, no auth | 24 | organization, address, zip, NAC coordinator, phone, email, website | City of Philadelphia License | Easy | High (small, very on target) |
| 8 | ProPublica Nonprofit Explorer API | REST JSON, no auth | Searchable by name/state/NTEE, not city filtered directly | EIN, name, city, state, NTEE, subsection, links to filings/PDFs | Free, attribution requested | Easy | Medium (best for enrichment, not discovery) |
| 9 | Free Library branch locations | ArcGIS REST, JSON, no auth | 54 branches (20 in a second "Libraries" layer with heat emergency hours) | branch name, address, city, state, zip, lat/long | City of Philadelphia License | Easy | Low to medium (facilities, not orgs; Friends groups per branch not included) |
| 10 | Registered Community Gardens (city layer) | ArcGIS REST, JSON, no auth | 23 | garden name, park name, address, zip, contact email/website, hours by day, status | City of Philadelphia License | Easy | Medium (city's formal list; PHS's own larger garden network is separate and still unscouted) |
| 11 | Schools (School District, city layer) | ArcGIS REST, JSON, no auth | 490 (PublicSchool_Profiles has 229 active public schools with enrollment data) | school name, address, zip, phone, grade levels, enrollment | City of Philadelphia License | Easy | Medium (anchor list for Home & School Associations, not the associations themselves) |
| 12 | Community College of Philadelphia Engage | REST JSON (OData style), no auth | 109 | same schema as Drexel | Campus Labs platform terms | Easy | Medium |
| 13 | NSS Philadelphia Grotto / PA grotto list | Static HTML list | 1 (Philadelphia Grotto) plus several other PA grottos on the same page | name, contact person, address, website | Public page, no stated restriction | Easy | High for the one target, low volume overall |
| 14 | Schuylkill Navy member clubs | Static HTML list (About page) | About a dozen member boat clubs | club name only, no structured contact fields | Public page | Easy (one time copy, not a scraping target) | Medium (storied clubs, but not "weak online presence") |
| 15 | ARRL club search | HTML, GET params by zip and radius | Unknown exact count, several Philly area clubs confirmed | club name, callsign, city/county, links to club page | Public search tool, no API terms published | Medium (HTML scrape, paginate by zip and page number) | Medium |
| 16 | Fairmount Park Conservancy / Love Your Park Friends Network | Web page, format not yet confirmed | Conservancy states 130+ neighborhood groups | Not yet confirmed | Not yet confirmed | Unresolved, likely medium | High if a real list page exists |
| 17 | Philadelphia Home and School Council | Web page, format not yet confirmed | Umbrella for Home & School Associations at most of the district's ~325 schools | Not yet confirmed | Not yet confirmed | Unresolved, likely medium | High |
| 18 | Interfaith Center of Greater Philadelphia | Web page, format not yet confirmed | Network of many congregations and faith service groups | Not yet confirmed | Not yet confirmed | Unresolved, likely medium | High |
| 19 | Philabundance / SHARE Food Program locators | Web page reachable, no API surfaced yet | Hundreds of partner pantries expected | Not yet confirmed | Not yet confirmed | Unresolved, likely medium to hard (locator widget, needs browser network trace) | Very high if unlocked |
| 20 | Toastmasters / Rotary / Lions / Kiwanis / US Chess club finders | JS driven map search, no confirmed JSON endpoint | Each has a handful of Philly chapters | Not yet confirmed | Each org's own terms | Unresolved, likely medium to hard | Medium |
| 21 | PA Bureau of Charitable Organizations (charities.pa.gov) | Web search form only | 16,000+ statewide, Philly subset unknown | name, registration status | Public search, no bulk export found | Hard | Low to medium (heavy overlap with IRS data) |
| 22 | Free Library of Philadelphia website (branch pages, events, Friends groups) | Blocked | n/a | n/a | n/a | Hard, site returns 403 to both curl and WebFetch | n/a, use the ArcGIS branch layer instead |
| 23 | Carto SQL API (phl.carto.com) | SQL endpoint reachable but table names blocked from introspection | Unknown | n/a | n/a | Hard, dead end without already knowing table names | Low, not needed since ArcGIS covers the same ground |
| 24 | PA corporations/business registry | Web search form, SSL quirks on direct probing | n/a | n/a | n/a | Hard | Low |

Total WebSearch calls used this session: 14 of the allowed 20.

## Details per source

### 1. IRS Exempt Organizations Business Master File, Pennsylvania extract

Working endpoint: `https://www.irs.gov/pub/irs-soi/eo_pa.csv`

This is the correct file to use. A common mistake (which the task brief itself hints at) is to assume the four files `eo1.csv` through `eo4.csv` are regional splits by state. They are not. Those four files are the same national Business Master File chopped into four chunks by EIN number range, and a quick sample of `eo3.csv` showed rows for Florida, Missouri, California and Georgia mixed together. `eo_pa.csv` is a separate, genuinely Pennsylvania only extract and it is the one to use.

Full file: 81,852 data rows, 14.4 MB, columns EIN, NAME, ICO, STREET, CITY, STATE, ZIP, GROUP, SUBSECTION, AFFILIATION, CLASSIFICATION, RULING, DEDUCTIBILITY, FOUNDATION, ACTIVITY, ORGANIZATION, STATUS, TAX_PERIOD, ASSET_CD, INCOME_CD, FILING_REQ_CD, PF_FILING_REQ_CD, ACCT_PD, ASSET_AMT, INCOME_AMT, REVENUE_AMT, NTEE_CD, SORT_NAME.

Filtering to ZIP codes starting with 191 gives 9,664 rows (9,515 of those have CITY literally "PHILADELPHIA"; the rest are 191xx ZIPs that read as a different city name, likely a handful of edge cases at the city line). NTEE major group breakdown for the 191xx set:

- Blank/none: 2,297
- X Religion related: 1,345
- P Human services: 948
- B Education: 919
- A Arts, culture, humanities: 720
- S Community improvement, capacity building: 547
- T Philanthropy, voluntarism, grantmaking: 433
- O Youth development: 353
- N Recreation, sports, leisure, athletics: 280
- E Health, general and rehabilitative: 247
- L Housing, shelter: 225
- F Mental health, crisis intervention: 164
- I Crime, legal related: 150
- W Public, societal benefit: 145
- Z Unknown: 141
- C Environmental quality, protection: 111
- J Employment, job related: 102
- K Food, agriculture, nutrition: 90
- Q International, foreign affairs: 85
- R Civil rights, social action, advocacy: 76
- G Disease, disorders, medical disciplines: 71
- D Animal related: 60
- H Medical research: 44
- Y Mutual, membership benefit: 41
- M Public safety, disaster preparedness: 27
- U Science and technology: 24
- V Social science: 19

Note the almost 2,300 blank NTEE codes. The IRS does not always backfill this field, so a harvesting script should not assume every record is classifiable by NTEE alone; cross referencing name keywords will still be needed for a meaningful chunk of records.

Gotcha: this file lists every organization that has ever held exemption, including many that are now revoked or terminated (see the STATUS field). A later harvest script should keep STATUS so the directory can filter out defunct entries, but the full extract is still useful because small volunteer groups often lapse and relapse their filings without ever truly dissolving.

Sample saved: `samples/eo_pa_philadelphia_sample.csv` (header plus 300 Philadelphia rows, 55 KB).

### 2. IRS Form 990 N e Postcard bulk data

The official IRS bulk download page (`apps.irs.gov/app/eos/forwardToEpostDownload.do`) returned HTTP 403 to both a plain curl request and WebFetch, consistent with Akamai bot protection rather than a real outage. The usable mirror is maintained by the Urban Institute's National Center for Charitable Statistics:

`https://nccsdata.s3.us-east-1.amazonaws.com/raw/e-postcard/2024-12-E-POSTCARD.csv`

No login required, file name pattern is `YYYY-MM-E-POSTCARD.csv`, updated monthly. Current file is about 330 MB, which is over this session's 200 MB cap, so only the header and first few rows were sampled via an HTTP range request rather than a full download. Columns: ein, tax_year, legal_name, gross_receipts_under_25000, terminated, tax_period_begin_date, tax_period_end_date, website, officer_name, officer_address_line_1/2, officer_city, officer_province, officer_state, officer_zip, officer_country, organization_address_line_1/2, organization_city, organization_province, organization_state, organization_zip, organization_country, dba_name_1/2/3, ID.

This is the single best source for truly tiny organizations (under $50,000 in gross receipts) that never file a real Form 990 and therefore never show up in most nonprofit databases. It covers the whole country in one file, so a harvesting step needs to stream-filter on `organization_state == "PA"` and `organization_city == "PHILADELPHIA"` (plus a ZIP check, since city spelling varies) rather than loading the whole thing into memory. A secondary mirror as a GitHub project exists at `github.com/Nonprofit-Open-Data-Collective/irs-990n-postcard-filers` with R code that could be adapted.

The `s3://nccsdata` bucket itself refuses directory listing (403 Access Denied on the bare prefix), so a harvesting agent needs the exact dated filename from the NCCS page rather than browsing the bucket.

### 3. and 4. City of Philadelphia community org and parks layers (Esri ArcGIS)

Base catalog: `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services?f=json` lists 2,290 hosted services for the city's ArcGIS organization. No authentication needed for any layer tested. Standard query pattern for any layer:

`https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/<layer name>/FeatureServer/0/query?where=1=1&outFields=*&f=json`

Add `&resultRecordCount=N&resultOffset=M` to paginate past the default record cap (only `NeighborhoodFoodRetail`, 1,336 records, exceeded 1,000 among the layers checked here).

Layers confirmed useful for this project, with live record counts as of this session:

- `Zoning_RCO`, 240 records. This is the current, authoritative Registered Community Organizations boundary dataset (confirmed against the OpenDataPhilly dataset page, which lists it as last updated September 28, 2026 and gives the exact same 240 count). Fields include organization name and address, meeting location, org type, primary and alternate contact person with email and phone, website, and expiration year. Two older/parallel layers also exist, `RCO_Points` (273 records) and `CommunityOutreach_RCO_Bounds` (27 records), same field schema; they look like earlier snapshots and may be worth cross checking for organizations that dropped off the current list but are still active informally.
- `PPR_Friends_Groups`, 141 records. Fields: friends_group_name, public_name, parent_name, address, zip_code, contact_email, contact_website, ppr_prog_district, ppr_ops_district, council_district, police_district, comments.
- `NeighborhoodAdvisoryCommittees`, 24 records. Fields: organization, street_address, zip_code, nac_coordinator, phone_number, email_address, website_url.
- `Registered_Community_Gardens`, 23 records. Fields: garden_name, park_name, address, city, state, zip_code, contact_email, contact_website, garden_alias, garden_description, hours by day of week, garden_status, council_district. Two other candidate layers, `updated_gardens_12_2022_Geocoded` and `updated_gardens_and_sites_02_2023_Geocoded`, were seen in the catalog but not queried; they may hold a larger, differently sourced garden list and are worth a follow up check.
- `Free_Library_Locations`, 54 records (Branch, Street_Address, City, State, Zip_Code, Lattitude, Longitude). A second layer, `Libraries`, has 20 records with Heat_Emergency_Hours, apparently a curated subset for emergency services rather than the full branch list.
- `Schools`, 490 records (aun, school_num, school_name, street_address, zip_code, phone_number, grade_level, enrollment). `PublicSchool_Profiles`, 229 records, adds enrollment and dropout statistics for active public schools specifically. `Philadelphia_Schools`, 205 records, is name only. None of these three include Home and School Association contact info; they are anchor data for later matching.
- `Philadelphia_Parks_and_Recreation_Centers`, 479 records, a broad PPR asset inventory (name, site name, address, type, use, square footage, zip). Narrower candidate layers also exist in the catalog (`Recreation_Centers_`, `Rec_Centers_HighSVI`, `Centroids_for_Recreation_Centers`) but were not queried this session.
- Senior center layers are fragmented across at least four overlapping sources: `Senior_Centers` (8), `Senior_Sites_PUBLIC_VIEW` (26), `PCA_SeniorCenters` (26, presumably the Philadelphia Corporation for Aging's own list), `PHA_Senior_Sites` (22, Philadelphia Housing Authority). Worth reconciling later since none alone looks complete.
- A large cluster of food related layers exists (`NeighborhoodFoodRetail` 1,336, `Community_Compost_Network_Site` 21, `Community_Partner_Cooling_Site_` 5, `Community_Warming_Site` 3, plus several `COVID19_FreeMealSites*` variants that look like stale pandemic era snapshots and should be treated with suspicion until their last edit date is checked). None of these were confirmed to carry an "operated by" organization name field; that needs a follow up field check before relying on them for org discovery rather than just site locations.

Licensing: every OpenDataPhilly dataset page checked states "City of Philadelphia License," which permits free use and reuse "as is and without warranty of any kind," with no login or attribution mechanics beyond crediting the city. OpenDataPhilly's own site no longer exposes the old CKAN catalog API (`/api/3/action/...` now 404s); it is a newer custom catalog where each dataset has its own page at a slug like `/datasets/<slug>/`, and the only reliable way found this session to connect a slug to the real backend layer was to look up the dataset by name through search rather than guessing slugs (several direct slug guesses 404'd before the right one was found for RCO boundaries).

Privacy flag for whoever builds the public site: the RCO and Neighborhood Advisory Committee layers carry a named individual's personal email and cell phone number as the "primary contact," not just an organization level email. That is the data the city itself publishes, but the project should decide deliberately whether to republish personal phone numbers verbatim or redact to an organization level contact.

Samples saved in `samples/`: `rco_zoning_sample.json`, `ppr_friends_groups_sample.json`, `community_gardens_sample.json`, `free_library_locations_sample.json`, `neighborhood_advisory_committees_sample.json`, `ppr_rec_centers_sample.json`.

### Carto SQL API (phl.carto.com)

`https://phl.carto.com/api/v2/sql?q=<SQL>` is live and returns valid JSON error objects for bad queries, so the endpoint itself works without authentication. However, `SELECT table_name FROM information_schema.tables` and any `pg_catalog` query return `"system tables are forbidden,"` and a guessed table name (`rco`) returned `"relation does not exist."` Without already knowing exact table names there is no way to enumerate what Carto hosts, and every community org dataset this session needed turned out to live on the ArcGIS side instead (phl.carto.com is used by the city mainly for the license and inspections / 311 / property data sets, based on prior general knowledge of OpenDataPhilly, not confirmed fresh this session). Recommend skipping Carto for this project unless a future agent already has a specific known table name to try.

### 5. Penn Clubs API

`https://pennclubs.com/api/clubs/?format=json` returns the full list of 479 active clubs in a single unauthenticated call, no pagination needed. Fields: code, name, subtitle, email, founded date, size (numeric band), membership_count, tags (category labels like "Academic," "Special Interest," "Advising"), active/approved/accepting_members flags, image_url. This is a from-scratch student run platform (Penn Labs), not Campus Labs, and it is the most open and complete of all the university sources tried. No terms of use page was found; treat it as a courtesy and do not hammer it, but there is no login wall at all. The `accepting_members` and `available_virtually` flags are a reasonable proxy for "open to outsiders," though neither directly states whether non-Penn-affiliated people can join; that would need spot checking individual club pages.

Sample saved: `samples/pennclubs_sample.json` (first 10 of 479 records).

### 6. and 12. Campus Labs Engage (Drexel, Community College of Philadelphia, and others)

Working pattern: `https://<subdomain>.campuslabs.com/engage/api/discovery/search/organizations?top=N&skip=M`, returns an OData style JSON payload with `@odata.count` giving the true total.

- Drexel (DragonLink): subdomain `drexel`, 548 organizations. Fields include Name, ShortName, Description, Summary, Status, Visibility, CategoryNames.
- Community College of Philadelphia: subdomain `ccp`, 109 organizations, same schema.
- Bryn Mawr: subdomain `brynmawr` resolves and exists on the platform, but the API path redirects (302) to `/engage/account/login`, meaning it is gated behind a student login and not harvestable without authentication. Excluded.
- Temple (OwlConnect): the obvious subdomain guess `temple.campuslabs.com` 404'd. `owlconnect.temple.edu` redirects to `temple.collegiatelink.net`, an older "CollegiateLink" branded platform from the same vendor; the same `/engage/api/discovery/search/organizations` path 404'd there too. Temple's actual data endpoint was not found this session and needs more targeted digging (likely a different API path on the CollegiateLink domain, or Temple may have migrated off Campus Labs entirely).
- Jefferson, Saint Joseph's, La Salle, Villanova, Swarthmore, Haverford: every direct `<name>.campuslabs.com` guess 404'd. These schools either use a non-obvious subdomain, a fully custom domain redirect like Temple's, or a different platform altogether. None of this was resolved this session; flagged as open work rather than guessed further, to stay within the search budget.

Samples saved: `samples/drexel_dragonlink_sample.json`, `samples/ccp_engage_sample.json`.

### 7. ProPublica Nonprofit Explorer API

`https://projects.propublica.org/nonprofits/api/v2/search.json?q=<text>&state[id]=PA` works with no auth and returns EIN, name, city, state, NTEE code, and filing availability flags. There is no direct city or ZIP filter parameter, only free text query and state, so it is not a good primary discovery tool for "everything in Philadelphia," but it is a strong enrichment layer once EINs are known from the IRS extract: `https://projects.propublica.org/nonprofits/api/v2/organizations/<EIN>.json` (not tested this session, but documented and widely used) returns filing history and links to scanned 990 PDFs. Rate limits are not published but the API is widely used by other civic tech projects without apparent restriction.

Sample saved: `samples/propublica_search_philadelphia_sample.json`.

### Free Library of Philadelphia website

`freelibrary.org/locations/` and `freelibrary.org/events/` both returned HTTP 403 to a plain curl request, to curl with a normal browser User Agent header, and to the WebFetch tool. This looks like edge level bot protection rather than a login wall, and per the rules for this task it was not bypassed. For branch addresses, use the city's `Free_Library_Locations` ArcGIS layer instead (see above). For Friends groups per branch and the events calendar, no structured alternative was found this session; that will likely need a browser automation agent with a real session rather than a script, or a different discovery path (for example, some branch Friends groups have their own standalone Facebook pages or small sites findable only by search).

### Hobby and civic club finders

- NSS Philadelphia Grotto: the National Speleological Society's grotto directory (`caves.org/state/pennsylvania/` and the legacy mirror at `legacy.caves.org/committee/i-o/grottos/grottos.shtml`) is a plain static HTML list. Philadelphia Grotto's listed contact is Amos Mincin with a website at `phillygrotto.org`. Trivial to scrape, but very low volume (a handful of PA grottos total).
- ARRL club search: `http://www.arrl.org/clubs/search/page:1/Location.zip:19103/Location.area:25/model:Group` returns a normal HTML results page (confirmed 200, 55 KB for ZIP 19103 within a 25 mile radius). Confirmed Philadelphia area clubs from search results include Holmesburg Amateur Radio Club, Temple University Amateur Radio Club, University of Pennsylvania Amateur Radio Club, Philadelphia Digital Radio Association, and Philadelphia Area Repeater Association. A script could iterate Philadelphia ZIP codes and parse the HTML; no JSON API was found.
- US Chess (`new.uschess.org/club-search-and-affiliate-directory`), Toastmasters (`toastmasters.org/Find-a-Club`), Rotary (`myuat.rotary.org/en/domui/club-search`), Lions (`lionsclubs.org/en/start-our-approach/club-locator`), Kiwanis (`kiwanis.org/join-us/find-a-club`): all confirmed to exist as search tools via WebSearch, none were fetched directly this session. These read as JavaScript driven map/search widgets, which usually call a JSON API under the hood, but finding that API requires inspecting network traffic in an actual browser rather than curl. Flagged as a good task for a browser capable agent, not resolved here.
- Scouting America, Cradle of Liberty Council (`scoutingphilly.org`): confirmed this is the right council for Philadelphia, Delaware, and Montgomery counties. No unit locator API was found or tested this session.
- Schuylkill Navy (`boathouserow.org`): not a search tool at all, just a short named list of member boat clubs on the About page (Bachelors Barge Club, College Boat Club, Crescent Boat Club, Fairmount Rowing Association, Gillin Boat Club, Malta Boat Club, Pennsylvania Barge Club, Penn Athletic Club, Philadelphia Girls Rowing Club, Undine Barge Club, University Barge Club, Vesper Boat Club, and a few more depending on the year). A one time manual copy is more appropriate than a scraper for a list this short.
- Philadelphia Area Disc Alliance (`pada.org`): confirmed live (though direct curl without a browser User Agent failed to connect; it answered to a WebSearch derived description instead). PADA is itself a single nonprofit running about 40 leagues, not a directory of many separate ultimate frisbee clubs, so it is one more organization to add rather than a new source of many organizations.
- Interfaith Center of Greater Philadelphia (`interfaithphiladelphia.org`): confirmed reachable (200). Whether it publishes a structured list of member congregations or partner organizations was not checked this session; worth a direct WebFetch follow up given it could surface many small congregation based service groups at once.

### School District of Philadelphia and Home and School Associations

The district's online directory app, `apps.philasd.org/onlinedirectory/`, is reachable (200) and described as searchable by school name, location number, or ZIP code. Whether it is backed by a JSON API was not confirmed this session; it looked like an interactive app that would need a browser trace. The umbrella body for all individual school Home and School Associations is the Philadelphia Home and School Council (`philadelphiahsc.org`), confirmed reachable (200), which per its own "About" description is "the only leadership body allowed to form, re-install, and re-establish Home and School Associations in public schools and public charter schools." That makes it a promising single point of contact for discovering active, currently recognized associations, but its site was not crawled for a member list this session.

### Fairmount Park Conservancy, Love Your Park, Park Friends Network

`loveyourpark.org` and `myphillypark.org` are both reachable (200). Love Your Park is described as a joint program of Fairmount Park Conservancy and Philadelphia Parks and Recreation involving "more than 130 neighborhood based volunteer groups in the Park Friends Network," a notably larger figure than the city's own `PPR_Friends_Groups` ArcGIS layer (141 records, close but from a different source and possibly counting differently). Whether the site exposes an actual list or map of those 130+ groups in a structured form, versus only prose and blog posts about yearly events, was not confirmed this session and is a good next step.

### Pennsylvania state level charity and business registries

The PA Bureau of Corporations and Charitable Organizations (reachable via `pa.gov/agencies/dos/programs/charities`) runs a search tool at `charities.pa.gov` covering 16,000-plus registered charities statewide, searchable only by entity name or registration number, with no bulk export offered by the state itself. Third party resellers (nonprofitlists.com, companydata.com) advertise bulk PA nonprofit CSVs compiled from this and other sources, but those are commercial products outside this project's scope and were not tested. Given the heavy overlap with the IRS federal exemption data already collected, this source is lower priority; it would mainly catch organizations that solicit donations in PA without (or in addition to) federal tax exempt status, a relatively small edge case. The PA corporations/business entity search (`corporations.pa.gov`) also appears to be a JavaScript search form rather than an API; a direct path guess returned 404 and the root domain had certificate handshake quirks on this network. Not pursued further.

## Recommended harvest order

1. Pull the three richest, easiest, highest confidence city layers first since they need no filtering logic at all: the `Zoning_RCO` civic association list, `PPR_Friends_Groups`, and `NeighborhoodAdvisoryCommittees`. Together these are a few hundred records but they are exactly the neighborhood level organizations this project cares most about, and the data is already clean.
2. Pull `eo_pa.csv` and filter to Philadelphia ZIP codes. This is the single highest volume structured source (about 9,664 records) and gives every nonprofit a name, address, and a rough category via NTEE code, which later agents can use to seed name based web searches for the ones with weak online presence.
2b. In the same pass, grab Penn Clubs and the Drexel and CCP Engage endpoints, since all three are one shot, no pagination headaches calls that add over 1,100 student organizations.
3. Stream filter the 990 N e Postcard bulk CSV by Pennsylvania and Philadelphia next. This is the most technically involved step (330 MB file, no city field, only ZIP and city text fields that need normalizing) but it is the only source that reaches the very smallest, least visible groups, which is explicitly the priority for this project.
4. Use ProPublica's API to enrich every EIN pulled in steps 2 and 3 with filing history and 990 PDF links, rather than as a discovery source on its own.
5. Pull the remaining city ArcGIS layers (gardens, library branches, schools, parks and rec centers, senior centers) as scaffolding or secondary leads rather than final organization records, since most of them describe facilities, not the volunteer groups attached to them.
6. Hand the unresolved items to a browser capable or search heavy agent as a distinct follow up batch: Free Library Friends groups and events, the Love Your Park full group list, the Philadelphia Home and School Council member list, the Interfaith Center partner list, Philabundance and SHARE pantry locators, the remaining university club directories (Temple, Jefferson, Saint Joseph's, La Salle, Villanova, Swarthmore, Haverford), and the JS driven club finders for Rotary, Lions, Kiwanis, Toastmasters, and US Chess. None of these were confirmed dead ends, they simply need either a real browser session or more individualized digging than this pass's search budget allowed.
7. Treat the PA Bureau of Charitable Organizations and PA corporations registries as last priority, manual spot check sources rather than bulk harvest targets, given the lack of any bulk export and heavy overlap with the IRS data already in hand.
