# Brief: platform leads (lane E)

Your slice names one platform and a set of topics. Platforms such as Meetup, Join Philly,
Eventbrite, Idealist and GivePulse list many Philadelphia groups, but **their terms forbid scraping
or bulk reuse, so they are lead sources only.** You use them to learn a group's name and link, then
you check the group from **its own pages** (or another public page that is not the platform) and
write the record from those.

Rules for the platform pages (these are hard rules):
- Read individual public pages at human pace: one topic or listing page at a time, never many in a
  burst, never by script. At most 12 platform pages in total for your whole run.
- Never log in, never create an account, never click RSVP, join, apply or contact, never submit a
  form. If a page needs a login, shows a bot check, or returns 403 or 429, record it in `blocked`
  and stop using that platform. Do not retry it or try another address for the same page.
- From a platform page, record only facts: the group's name, its topic, and its link. Never copy a
  description, blurb or review.
- A platform page is never the source of a record. `sources` must be the group's own site, or a
  public page that is not one of these platforms (a news story, a partner organization's site).
- Credit Join Philly in `notes` for any lead that came from it.

Method, in this order (searches are scarce, fetches are cheap):
1. Fetch the starting pages your slice names. If they are blocked, use one or two searches to find
   the same groups another way (for example a search for the topic plus "Philadelphia" plus
   "club"), and say in `notes` that the platform was blocked.
2. For every group you collected, find its own website. The platform page often links it; if not,
   one search for the exact group name plus "Philadelphia" usually finds it. Do not guess domains.
3. Fetch the group's own home page, then its events or schedule page, and write a full tier 1
   record per `_common.md`. Leave `match.lead_ids` empty; set `match.website`.
4. A group that has no page of its own anywhere except the platform: put it in `leads_only` with
   the platform link and a note, unless another public page (news, a partner site, a venue's
   calendar) confirms it is active, in which case write a record with `confidence: "low"`.

Aim for 20 to 40 checked records. Favor groups that meet regularly and welcome newcomers, and cover
different neighborhoods, ages, price levels and communities. Skip businesses selling classes with no
community around them, one off events, partisan political groups, and anything that only exists to
sell something. Do not worry about groups we may already have; the importer merges duplicates by
website and name.
