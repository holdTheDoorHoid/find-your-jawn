# Find Your Jawn

**Find your people in Philly.** A free directory and matching quiz for everyone who lives in
Philadelphia: nonprofits that need volunteers, civic associations, clubs, sports leagues, student
groups, cultural and heritage groups, faith communities' service work, support groups, and the small
word of mouth groups that never show up in a web search.

Answer a short quiz and get a handful of groups that fit you, why each one fits, and exactly how to
show up the first time. A couple of the picks will be gentle stretches, because the best thing you
join might be one step outside what you would normally choose.

> **Early preview.** The site is being built in the open. The directory is still being researched and
> listings may be incomplete or out of date.

Site: https://holdthedoorhoid.github.io/find-your-jawn/

## Know a group we missed, or run one?

Open an issue with the "Suggest a group" or "Correct a listing" form. Organizers can also ask for
their details to be removed the same way.

## How it is built

- `docs/PLAN.md`: what we are building and why, decisions, roadmap.
- `docs/DESIGN.md`: the quiz, matching, stretch picks and pages.
- `docs/RESEARCH.md`: how we find every group and measure how complete the list is.
- `docs/DATA_MODEL.md` and `docs/ETHICS.md`: formats and rules.

The data pipeline is Python (`pipeline/`); the site is TypeScript (`site/`) and runs entirely in your
browser. Nothing you answer in the quiz leaves your device.

## Credits

Data from the City of Philadelphia (City of Philadelphia License), the IRS, the Urban Institute's
National Center for Charitable Statistics, campus directories, and the groups themselves. Inspired in
part by [Join Philly](https://www.joinphilly.com/), a curated directory of Philly clubs worth visiting.

## License

Code: MIT. Written content and the directory data we produce: CC BY 4.0, except where a source's own
terms say otherwise.
