"""`fyj city-tier1`: scripted tier 1 research records for the City's own current lists.

A City layer is evidence that these groups exist now, so each gets a tier 1 record in the same
format a research agent hands in (DATA_MODEL section 6), written to research/inbox/<wave>/ and
imported with `fyj import-research`, which runs every publish check. Summaries are templates in our
own words, varied by kind and picked by a stable hash of the lead id, so a group never changes its
wording between runs. Nothing here guesses: a template says only what the layer supports.

Interest families, tags, motives, formats and roles are named here by their ids and then looked up
in data/vocab/ at run time. An id the vocabulary does not have is dropped and reported.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any

import yaml

from fyj.dates import month_diff
from fyj.groupfile import GroupStore
from fyj.groupindex import GroupIndex
from fyj.merge import Node, cluster_nodes, iter_leads, locations_for, make_node
from fyj.paths import Layout
from fyj.triage import TriageContext, decide, is_rec_center
from fyj.vocab import Vocab

WAVE = "w0-city-scripted"
PROGRAMS_SEEN = "2026-10-04"  # the date the hand researched program inventory was compiled

COUNCIL_URL = (
    "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/"
    "recreation-advisory-councils/"
)
PORTAL_URL = "https://communityschools.galaxydigital.com/"


@dataclass
class Profile:
    """Vocabulary ids a kind of record asks for. Missing ids are dropped at run time."""

    kind: str
    categories: list[str]
    interests: list[str]
    motives: list[str] = field(default_factory=list)
    formats: list[str] = field(default_factory=list)
    roles: list[str] = field(default_factory=list)
    crowd: list[str] = field(default_factory=list)
    commitment: str | None = None
    cost_level: str | None = None


PROFILES: dict[str, Profile] = {
    "rco": Profile(
        "civic",
        ["neighborhood-civic"],
        ["civic_association", "community_development"],
        ["values", "social"],
        ["conversation", "lead_organize"],
        ["organize", "figure_out"],
        ["neighbors"],
    ),
    "nac": Profile(
        "civic",
        ["neighborhood-civic"],
        ["community_development", "civic_association"],
        ["values", "social"],
        ["conversation", "lead_organize"],
        ["organize", "figure_out"],
        ["neighbors"],
    ),
    "rec": Profile(
        "program",
        ["sports-teams", "kids-youth-mentoring", "neighborhood-civic"],
        ["kickball_rec_leagues", "after_school_camps", "rec_center_council"],
        ["social", "values"],
        ["team_play", "conversation"],
        ["hands_on", "organize"],
        ["all_ages"],
    ),
    "library": Profile(
        "program",
        ["books-writing"],
        ["library_programs", "book_club"],
        ["understanding", "social"],
        ["learn_skill", "conversation"],
        ["figure_out", "help_teach"],
        ["all_ages"],
        cost_level="free",
    ),
    "senior": Profile(
        "program",
        ["seniors-intergenerational"],
        ["senior_centers", "senior_activities"],
        ["social", "protective"],
        ["conversation", "side_by_side"],
        ["hands_on", "help_teach"],
        ["seniors"],
    ),
    "garden": Profile(
        "garden",
        ["gardening-greening"],
        ["community_garden"],
        ["values", "social", "enhancement"],
        ["side_by_side"],
        ["hands_on"],
        ["neighbors"],
    ),
    "friends": Profile(
        "friends_group",
        ["nature-environment"],
        ["friends_of_park", "park_cleanup"],
        ["values", "social"],
        ["side_by_side"],
        ["hands_on", "organize"],
        ["neighbors"],
    ),
    "school": Profile(
        "program",
        ["kids-youth-mentoring"],
        ["after_school_camps", "tutoring", "mentoring"],
        ["values", "protective"],
        ["side_by_side", "conversation"],
        ["help_teach", "hands_on"],
        ["kids"],
    ),
}

# Hand mapped profiles for the City volunteer programs (data/seeds/city_programs.yaml). `open_to`
# is only given where the seed's wording says it is not simply "any resident".
PROGRAM_PROFILES: dict[str, dict[str, Any]] = {
    "Philly Reading Coaches": dict(
        categories=["kids-youth-mentoring", "books-writing"],
        interests=["tutoring", "literacy_tutoring"],
        motives=["values", "protective"],
        formats=["conversation", "side_by_side"],
        roles=["help_teach"],
        crowd=["kids"],
        commitment="weekly",
        schedule="Weekly after school sessions, October through May",
    ),
    "Power Up Tech Corps": dict(
        categories=["making-tech", "careers-skills-professional"],
        interests=["digital_skills", "skills_volunteering"],
        motives=["values", "career"],
        formats=["learn_skill", "side_by_side"],
        roles=["help_teach", "hands_on"],
        crowd=["all_adults"],
        commitment="weekly",
        schedule="Year round, rolling admission",
        season="year_round",
    ),
    "Philadelphia Medical Reserve Corps (PMRC)": dict(
        categories=["emergency-disaster", "health-wellness"],
        interests=["emergency_response_teams", "health_outreach"],
        motives=["values", "protective"],
        formats=["behind_the_scenes", "side_by_side"],
        roles=["hands_on", "help_teach"],
        crowd=["all_adults"],
        commitment="ongoing_role",
        schedule="Trainings and exercises through the year, deployed when needed",
        season="year_round",
        open_to="residents",
    ),
    "Town Watch Integrated Services": dict(
        categories=["neighborhood-civic", "emergency-disaster"],
        interests=["town_watch", "preparedness_planning"],
        motives=["values", "protective"],
        formats=["side_by_side", "learn_skill"],
        roles=["hands_on", "organize"],
        crowd=["neighbors"],
        commitment="ongoing_role",
        season="year_round",
        schedule="Year round, through a Town Watch group on your block",
    ),
    "Citizens Police Academy": dict(
        categories=["neighborhood-civic"],
        interests=["police_advisory"],
        motives=["understanding"],
        formats=["learn_skill"],
        roles=["figure_out"],
        crowd=["all_adults"],
        commitment="seasonal",
        season="fall",
        schedule="One evening a week for about ten weeks each fall",
    ),
    "Police Explorer Cadet Program": dict(
        categories=["kids-youth-mentoring"],
        interests=["youth_leadership"],
        motives=["career", "enhancement"],
        formats=["learn_skill"],
        roles=["hands_on"],
        crowd=["teens"],
        commitment="ongoing_role",
        season="year_round",
    ),
    "Fire Explorers": dict(
        categories=["kids-youth-mentoring", "emergency-disaster"],
        interests=["youth_leadership", "volunteer_fire_ems"],
        motives=["career", "enhancement"],
        formats=["learn_skill", "team_play"],
        roles=["hands_on"],
        crowd=["teens"],
        commitment="ongoing_role",
        schedule="Every other Saturday, April through November",
    ),
    "Become a block captain": dict(
        categories=["neighborhood-civic"],
        interests=["block_captain", "clean_blocks"],
        motives=["values", "social"],
        formats=["lead_organize", "side_by_side"],
        roles=["organize", "lead"],
        crowd=["neighbors"],
        commitment="ongoing_role",
        season="year_round",
    ),
    "Philadelphia More Beautiful Committee Clean Block Program": dict(
        categories=["neighborhood-civic"],
        interests=["clean_blocks", "block_captain"],
        motives=["values", "social"],
        formats=["side_by_side"],
        roles=["hands_on", "organize"],
        crowd=["neighbors"],
        commitment="seasonal",
        schedule="Saturday cleanups in spring and fall",
    ),
    "Philly Spring Cleanup": dict(
        categories=["nature-environment", "neighborhood-civic"],
        interests=["park_cleanup", "clean_blocks"],
        motives=["values", "social"],
        formats=["one_off_event", "side_by_side"],
        roles=["hands_on"],
        crowd=["all_ages"],
        commitment="one_off",
        season="spring",
        schedule="One day each April",
    ),
    "Park Friends groups": dict(
        categories=["nature-environment"],
        interests=["friends_of_park", "park_cleanup"],
        motives=["values", "social"],
        formats=["side_by_side"],
        roles=["hands_on", "organize"],
        crowd=["neighbors"],
        season="year_round",
    ),
    "Recreation Advisory Councils": dict(
        categories=["neighborhood-civic"],
        interests=["rec_center_council"],
        motives=["values", "social"],
        formats=["conversation", "lead_organize"],
        roles=["organize", "figure_out"],
        crowd=["neighbors"],
        commitment="monthly",
        season="year_round",
        schedule="Monthly meetings at your recreation center",
    ),
    "Business and individual volunteer opportunities (Parks and Recreation)": dict(
        categories=["nature-environment"],
        interests=["park_cleanup", "friends_of_park"],
        motives=["values", "social"],
        formats=["side_by_side"],
        roles=["hands_on"],
        crowd=["all_ages"],
        commitment="monthly",
        season="year_round",
        schedule="Second Saturday of each month",
    ),
    "Love Your Park": dict(
        categories=["nature-environment"],
        interests=["park_cleanup", "friends_of_park"],
        motives=["values", "social"],
        formats=["one_off_event", "side_by_side"],
        roles=["hands_on"],
        crowd=["all_ages"],
        commitment="one_off",
        schedule="A week each spring and a service day each fall",
    ),
    "TreePhilly yard tree giveaways": dict(
        categories=["nature-environment", "gardening-greening"],
        interests=["tree_tending"],
        motives=["values", "social"],
        formats=["one_off_event", "side_by_side"],
        roles=["hands_on"],
        crowd=["all_ages"],
        commitment="one_off",
        schedule="Spring and fall giveaway events",
    ),
    "Philadelphia Youth Commission": dict(
        categories=["neighborhood-civic", "kids-youth-mentoring"],
        interests=["youth_leadership", "community_development"],
        motives=["values", "enhancement"],
        formats=["conversation", "lead_organize"],
        roles=["lead", "figure_out"],
        crowd=["teens"],
        commitment="monthly",
        season="year_round",
        open_to="residents",
    ),
    "City boards and commissions, resident seats": dict(
        categories=["neighborhood-civic", "careers-skills-professional"],
        interests=["board_service", "community_development"],
        motives=["values", "career"],
        formats=["conversation", "lead_organize"],
        roles=["figure_out", "lead"],
        crowd=["all_adults"],
        season="year_round",
        open_to="residents",
    ),
    "Election Board Worker (poll worker)": dict(
        categories=["neighborhood-civic"],
        interests=["voter_education"],
        motives=["values", "social"],
        formats=["one_off_event", "side_by_side"],
        roles=["hands_on", "organize"],
        crowd=["all_adults"],
        commitment="one_off",
        schedule="One election day, with required training beforehand",
        open_to="residents",
    ),
    "Foster Grandparents": dict(
        categories=["kids-youth-mentoring", "seniors-intergenerational"],
        interests=["mentoring", "retiree_corps"],
        motives=["values", "protective"],
        formats=["side_by_side", "conversation"],
        roles=["help_teach"],
        crowd=["seniors"],
        commitment="weekly",
        season="year_round",
        open_to="residents",
    ),
    "Serve Philadelphia VISTA Corps": dict(
        categories=["neighborhood-civic", "careers-skills-professional"],
        interests=["skills_volunteering", "community_development"],
        motives=["career", "values"],
        formats=["side_by_side", "behind_the_scenes"],
        roles=["organize", "hands_on"],
        crowd=["young_adults"],
        commitment="ongoing_role",
        schedule="A full time service year, new class starting in late summer",
    ),
    "Adult Education volunteer tutors": dict(
        categories=["science-learning", "books-writing"],
        interests=["adult_learning", "literacy_tutoring"],
        motives=["values", "understanding"],
        formats=["conversation", "learn_skill"],
        roles=["help_teach"],
        crowd=["all_adults"],
        season="year_round",
    ),
    "Point in Time Count volunteers": dict(
        categories=["hunger-housing-basic-needs"],
        interests=["homeless_outreach"],
        motives=["values", "protective"],
        formats=["one_off_event", "side_by_side"],
        roles=["hands_on"],
        crowd=["all_adults"],
        commitment="one_off",
        season="winter",
        schedule="One night each January",
    ),
    "Volunteer at a prison": dict(
        categories=["advocacy-rights"],
        interests=["justice_reform_reentry"],
        motives=["values", "understanding"],
        formats=["conversation"],
        roles=["help_teach"],
        crowd=["all_adults"],
        commitment="ongoing_role",
        season="year_round",
    ),
    "Free Library volunteer opportunities": dict(
        categories=["books-writing"],
        interests=["library_programs"],
        motives=["values", "understanding"],
        formats=["side_by_side", "conversation"],
        roles=["help_teach", "hands_on"],
        crowd=["all_ages"],
        season="year_round",
    ),
    "School District of Philadelphia classroom volunteers": dict(
        categories=["kids-youth-mentoring"],
        interests=["school_parent_groups", "tutoring"],
        motives=["values", "protective"],
        formats=["side_by_side", "conversation"],
        roles=["help_teach"],
        crowd=["kids"],
        season="year_round",
    ),
}
# Plain rewordings for programs whose seed wording sits too close to the City's own page text
# (the own words check holds the record otherwise).
SUMMARY_OVERRIDES: dict[str, str] = {
    "Town Watch Integrated Services": (
        "The City's Town Watch program helps neighbors form block patrol groups, trains and "
        "certifies them, and teaches disaster response skills in its CERT classes."
    ),
    "Become a block captain": (
        "Any resident can step up as captain of their own block: gather neighbors' signatures "
        "on a petition, then organize cleanups of the street alongside the Philadelphia More "
        "Beautiful Committee."
    ),
}
# Programs that are not a group a resident joins on their own: left at tier 0.
PROGRAMS_SKIPPED = {
    "Soak It Up Adoption": "an organization level grant, not an individual sign up",
    "Mural Arts Philadelphia volunteering": "a nonprofit partner listed by link only",
}


# -- text helpers ------------------------------------------------------------------------------


def _pick(variants: list[str], key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
    return variants[int(digest[:8], 16) % len(variants)]


def _where(district: str | None, vocab: Vocab) -> str:
    if district and district in vocab.planning_districts:
        return f"in the {vocab.planning_districts[district]} part of the city"
    return "in Philadelphia"


RCO_SUMMARIES = [
    "{name} is a Registered Community Organization (RCO) {where}. The City asks developers to "
    "talk with RCOs about nearby zoning and building plans, so this is a way for neighbors to "
    "have a say.",
    "A neighborhood group the City of Philadelphia has registered to be consulted on zoning and "
    "development {where}, {name} gives neighbors a place to hear about projects and respond.",
    "{name} is one of the community organizations registered with the City to review nearby "
    "zoning and building proposals {where}. Neighbors can follow what is planned and speak up.",
    "If you care about what gets built near you, {name} is a City registered community "
    "organization {where} that hears about zoning and development proposals.",
]
RCO_DOING = [
    "Neighbors come together to review nearby building and zoning proposals and share the "
    "group's view with the City and developers.",
    "Members follow zoning and development plans in the area and meet to talk them over.",
]
NAC_SUMMARIES = [
    "{name} is a Neighborhood Advisory Committee listed by the City of Philadelphia, a local "
    "community organization that works with the City on services and priorities {where}.",
    "A community organization named by the City as a Neighborhood Advisory Committee, {name} "
    "connects neighbors {where} with City services and a say in local priorities.",
    "{name} serves as a Neighborhood Advisory Committee for the City of Philadelphia, linking "
    "residents {where} to services and giving them a voice.",
]
NAC_DOING = ["Work with neighbors and the City on local services and what the area needs."]
REC_SUMMARIES = [
    "{name} is a City of Philadelphia Parks and Recreation center {where}. It offers programs "
    "and leagues for neighbors, and its advisory council is open to anyone who comes to a "
    "meeting and signs in.",
    "A neighborhood recreation center run by Philadelphia Parks and Recreation {where}, "
    "{name} hosts programs and leagues, plus an advisory council that any neighbor can join.",
    "{name} is a recreation center {where} with programs, leagues and a community advisory "
    "council. Showing up to one council meeting and signing in makes you a voting member.",
]
REC_DOING = [
    "Join center programs and leagues, or help the advisory council shape what the center offers.",
]
LIBRARY_SUMMARIES = [
    "{name} is a Free Library of Philadelphia branch {where}, with free programs, classes and "
    "events for kids, teens and adults. Check the branch for its current calendar.",
    "A neighborhood branch of the Free Library of Philadelphia {where}, {name} is a place for "
    "free books, computers and library programs for every age.",
    "{name} is one of the Free Library branches {where}, where neighbors find free programs "
    "and events as well as books and internet access.",
]
LIBRARY_DOING = ["Borrow books, use the computers and join free library programs and events."]
SENIOR_SUMMARIES = [
    "{name} is a senior center listed by the City of Philadelphia {where}, a place where older "
    "adults can get together for activities and services. Call ahead for hours.",
    "An older adult center {where}, {name} is on the City's list of senior centers and sites "
    "where people can meet, take part in activities and find services.",
    "{name} is a senior center {where} that the City lists as a place for older neighbors to "
    "gather and join activities.",
]
SENIOR_DOING = ["Drop in to meet other older adults and join the center's activities."]
GARDEN_SUMMARIES = [
    "{name} is a registered community garden {where}, listed by the City of Philadelphia. "
    "Neighbors grow food and flowers together; contact the garden to ask about a plot or a "
    "workday.",
    "A neighborhood garden on the City's list of registered community gardens {where}, {name} "
    "is tended by neighbors who share the work and the harvest.",
    "{name} is a City registered community garden {where}. Neighbors garden side by side, and "
    "the garden is the place to ask about joining.",
]
GARDEN_DOING = ["Garden alongside neighbors and help with workdays."]
FRIENDS_SUMMARIES = [
    "{name} is a Friends group for {park}, one of the volunteer groups that look after "
    "Philadelphia parks and playgrounds. Neighbors can join cleanups and events.",
    "Neighbors who care for {park} {where} meet as {name}, part of the City's network of park "
    "Friends groups.",
    "{name} is a volunteer Friends group listed by Philadelphia Parks and Recreation for "
    "{park}. It brings neighbors together to keep the space clean and lively.",
]
FRIENDS_DOING = ["Join park cleanups, plantings and events with your neighbors."]
SCHOOL_SUMMARIES = [
    "{school} is one of the City's Community Schools, where volunteers help with after school "
    "and family programs. Open shifts are listed on the City's volunteer portal.",
    "A Community School partnership between the City, the School District and neighbors, "
    "{school} welcomes volunteers through the City's volunteer portal.",
]
SCHOOL_DOING = ["Help with school based programs for students and families."]


def _district(locator: Any, loc: dict[str, Any]) -> str | None:
    return locator(loc) if locator else loc.get("planning_district")


def _seen_fields(lead: dict[str, Any]) -> list[str]:
    fields = ["name"]
    if lead.get("address") or lead.get("zip"):
        fields.append("locations")
    for key in ("website", "email", "phone", "contact_name"):
        if lead.get(key):
            fields.append(f"contacts.{key}")
    return fields


# -- the generator -----------------------------------------------------------------------------


@dataclass
class Generated:
    files: dict[str, dict[str, Any]] = field(default_factory=dict)  # agent -> payload
    skipped: dict[str, int] = field(default_factory=dict)
    unresolved: set[str] = field(default_factory=set)
    notes: list[str] = field(default_factory=list)

    def count(self) -> int:
        return sum(len(p["records"]) for p in self.files.values())


class Builder:
    def __init__(self, layout: Layout, vocab: Vocab, today: str, locator: Any = None) -> None:
        self.layout = layout
        self.vocab = vocab
        self.today = today
        self.month = today[:7]
        self.locator = locator
        self.out = Generated()
        self.ctx = TriageContext()
        self._leads: dict[str, list[dict[str, Any]]] = {}

    # -- vocabulary ------------------------------------------------------------------------

    def _ids(self, wanted: list[str], resolve: Any, label: str) -> list[str]:
        found = []
        for item in wanted:
            mapped = resolve(item)
            if mapped:
                if mapped not in found:
                    found.append(mapped)
            else:
                self.out.unresolved.add(f"{label} {item}")
        return found

    def vocab_fields(self, profile: Profile | dict[str, Any]) -> dict[str, Any]:
        def get(key: str) -> list[str]:
            if isinstance(profile, Profile):
                return getattr(profile, key)
            return profile.get(key) or []

        v = self.vocab

        def simple(name: str) -> Any:
            return lambda item: v.resolve_simple(name, item)

        return {
            "categories": self._ids(get("categories"), v.resolve_family, "category"),
            "interests": self._ids(get("interests"), v.resolve_tag, "interest"),
            "motives": self._ids(get("motives"), simple("motives"), "motive"),
            "formats": self._ids(get("formats"), simple("formats"), "format"),
            "roles": self._ids(get("roles"), simple("roles"), "role"),
            "crowd": self._ids(get("crowd"), simple("audiences"), "crowd"),
        }

    def kind(self, name: str) -> str:
        mapped = self.vocab.resolve_simple("kinds", name)
        if mapped is None:
            self.out.unresolved.add(f"kind {name}")
            return name
        return mapped

    # -- leads -----------------------------------------------------------------------------

    def leads(self, source: str) -> list[dict[str, Any]]:
        if not self._leads:
            for lead in iter_leads(self.layout.leads_dir):
                self._leads.setdefault(lead["source"], []).append(lead)
        return self._leads.get(source, [])

    def clusters(self, leads: list[dict[str, Any]]) -> list[list[Node]]:
        """Leads of one source that describe the same group (the two senior center lists)."""
        nodes = [make_node(lead) for lead in leads]
        out = cluster_nodes(nodes)
        out.sort(key=lambda c: c[0].lead_id)
        return out

    def locations(self, nodes: list[Node], label: str | None = None) -> list[dict[str, Any]]:
        locs = locations_for(nodes)
        for loc in locs:
            if label and loc["label"] == "Address":
                loc["label"] = label
            loc["planning_district"] = _district(self.locator, loc)
        return locs

    # -- record skeleton ---------------------------------------------------------------------

    def layer_record(
        self,
        key: str,
        nodes: list[Node],
        *,
        summary: str,
        what_you_do: str,
        name: str | None = None,
        label: str | None = None,
        extra_sources: list[dict[str, Any]] | None = None,
        **over: Any,
    ) -> dict[str, Any]:
        profile = PROFILES[key]
        first = nodes[0].lead
        contacts = {
            k: first.get(k) for k in ("website", "email", "phone", "contact_name") if first.get(k)
        }
        record: dict[str, Any] = {
            "match": {
                "lead_ids": sorted(n.lead_id for n in nodes),
                "group_id": None,
                "ein": None,
                "website": None,
            },
            "verdict": "publish",
            "name": name,
            "kind": self.kind(profile.kind),
            "summary": summary,
            "what_you_do": what_you_do,
            **self.vocab_fields(profile),
            "audience": {"open_to": "public"},
            "locations": self.locations(nodes, label),
            "contacts": contacts,
            "status": "active",
            "last_sign_of_life": self.month,
            "sign_of_life_url": first["source_url"],
            "sources": [
                {"url": first["source_url"], "seen": self.today, "fields": _seen_fields(first)},
                *(extra_sources or []),
            ],
            "research_tier": 1,
            "confidence": "medium",
        }
        if profile.commitment:
            record["commitment"] = profile.commitment
        if profile.cost_level:
            record["cost"] = {"level": profile.cost_level}
        record.update(over)
        return record

    def _add(self, agent: str, record: dict[str, Any], notes: str) -> None:
        payload = self.out.files.setdefault(
            agent,
            {
                "wave": WAVE,
                "agent": agent,
                "lane": "A",
                "model": "script",
                "searches_used": 0,
                "fetches_used": 0,
                "records": [],
                "leads_only": [],
                "blocked": [],
                "notes": notes,
            },
        )
        payload["records"].append(record)

    def _skip(self, reason: str) -> None:
        self.out.skipped[reason] = self.out.skipped.get(reason, 0) + 1

    def _where_for(self, locs: list[dict[str, Any]]) -> str:
        district = next(
            (loc["planning_district"] for loc in locs if loc.get("planning_district")), None
        )
        return _where(district, self.vocab)

    # -- sources -----------------------------------------------------------------------------

    # Which City list a group is filed under when it appears on several (a park Friends group that
    # is also a registered community organization is, first of all, a Friends group).
    LISTS = (
        ("friends", "city_friends", "city-friends", "Parks and Recreation Friends groups"),
        ("gardens", "city_gardens", "city-gardens", "City registered community gardens"),
        ("rec", "city_rec", "city-rec", "City recreation centers (Parks and Recreation inventory)"),
        ("libraries", "city_libraries", "city-libraries", "Free Library of Philadelphia branches"),
        ("senior", "city_senior", "city-senior", "City senior centers and sites"),
        ("nac", "city_nac", "city-nac", "City neighborhood advisory committees"),
        ("rco", "city_rco", "city-rco", "City registered community organizations (Zoning_RCO)"),
    )

    def _partisan_hide(self, cluster: list[Node]) -> None:
        lead = cluster[0].lead
        self._skip("rco: partisan ward committee, hidden")
        self._add(
            "city-rco",
            {
                "match": {
                    "lead_ids": [n.lead_id for n in cluster],
                    "group_id": None,
                    "ein": None,
                    "website": None,
                },
                "verdict": "hide",
                "hidden_reason": "partisan",
                "name": lead["name"],
                "kind": self.kind("civic"),
                "sources": [{"url": lead["source_url"], "seen": self.today, "fields": ["name"]}],
                "research_tier": 1,
            },
            "City registered community organizations (Zoning_RCO)",
        )

    def city_lists(self, index: GroupIndex | None, only: set[str] | None) -> None:
        """One record per group across the seven City lists. Leads of one group that sit on
        several lists are folded into the record of the most specific list."""
        nodes: list[Node] = []
        for key, source, _agent, _note in self.LISTS:
            if only is not None and key not in only:
                continue
            leads = self.leads(source)
            if key == "rec":
                eligible = [lead for lead in leads if is_rec_center(lead)]
                self.out.notes.append(
                    f"city_rec: {len(eligible)} of {len(leads)} records are real recreation "
                    "centers; the rest are parks, playgrounds, pools and other sites"
                )
                leads = eligible
            if key == "rco":
                partisan = [lead for lead in leads if decide(lead, self.ctx)]
                for cluster in self.clusters(partisan):
                    if str((cluster[0].lead.get("extra") or {}).get("org_type")) == "Ward":
                        self._partisan_hide(cluster)
                leads = [lead for lead in leads if not decide(lead, self.ctx)]
            nodes.extend(make_node(lead) for lead in leads)
        for cluster in self._groups(nodes, index):
            self._city_record(cluster)

    def _groups(self, nodes: list[Node], index: GroupIndex | None) -> list[list[Node]]:
        """Nodes grouped as the merge grouped them: by group file when there is one, else by
        matching names, EINs and websites among the City leads themselves."""
        if index is None:
            return sorted(cluster_nodes(nodes), key=lambda c: c[0].lead_id)
        by_group: dict[str, list[Node]] = {}
        loose: list[Node] = []
        for node in nodes:
            gid = index.by_lead.get(node.lead_id)
            if gid:
                by_group.setdefault(gid, []).append(node)
            else:
                loose.append(node)
        clusters = [sorted(v, key=lambda n: n.lead_id) for _, v in sorted(by_group.items())]
        clusters += sorted(cluster_nodes(loose), key=lambda c: c[0].lead_id)
        return clusters

    def _city_record(self, cluster: list[Node]) -> None:
        order = [key for key, *_ in self.LISTS]
        source_of = {source: key for key, source, *_ in self.LISTS}
        keys = {source_of[n.source] for n in cluster}
        key = min(keys, key=order.index)
        primary = sorted(
            (n for n in cluster if source_of[n.source] == key), key=lambda n: n.lead_id
        )[0]
        nodes = [primary] + [n for n in cluster if n is not primary]
        lead = primary.lead
        locs = self.locations(nodes)
        where = self._where_for(locs)
        name = lead["name"]
        if key == "libraries" and "library" not in name.lower():
            name = f"{name} Library"
        variants, doing = {
            "friends": (FRIENDS_SUMMARIES, FRIENDS_DOING),
            "gardens": (GARDEN_SUMMARIES, GARDEN_DOING),
            "rec": (REC_SUMMARIES, REC_DOING),
            "libraries": (LIBRARY_SUMMARIES, LIBRARY_DOING),
            "senior": (SENIOR_SUMMARIES, SENIOR_DOING),
            "nac": (NAC_SUMMARIES, NAC_DOING),
            "rco": (RCO_SUMMARIES, RCO_DOING),
        }[key]
        park = (lead.get("extra") or {}).get("parent_name") or "a local park"
        summary = _pick(variants, lead["lead_id"]).format(name=name, where=where, park=park)
        if key != "rco" and "rco" in keys:
            summary += (
                " It is also a registered community organization, so developers are asked to "
                "talk with it about nearby zoning and building plans."
            )
        elif key not in ("nac", "rco") and "nac" in keys:
            summary += " It is also a Neighborhood Advisory Committee for the City."
        extra_sources = None
        if key == "rec":
            extra_sources = [{"url": COUNCIL_URL, "seen": PROGRAMS_SEEN, "fields": ["summary"]}]
        record = self.layer_record(
            {"gardens": "garden", "libraries": "library"}.get(key, key),
            nodes,
            summary=summary,
            what_you_do=_pick(doing, lead["lead_id"]),
            name=name,
            extra_sources=extra_sources,
        )
        extra_contacts = {}
        for node in nodes[1:]:
            for field_name in ("website", "email", "phone", "contact_name"):
                value = node.lead.get(field_name)
                if (
                    value
                    and field_name not in record["contacts"]
                    and field_name not in extra_contacts
                ):
                    extra_contacts[field_name] = value
        record["contacts"].update(extra_contacts)
        seen_urls = {src["url"] for src in record["sources"]}
        for node in nodes[1:]:
            if node.lead["source_url"] not in seen_urls:
                seen_urls.add(node.lead["source_url"])
                record["sources"].append(
                    {
                        "url": node.lead["source_url"],
                        "seen": self.today,
                        "fields": _seen_fields(node.lead),
                    }
                )
        agent, note = next((a, n) for k, _s, a, n in self.LISTS if k == key)
        self._add(agent, record, note)

    # -- the City volunteer portal ----------------------------------------------------------------

    def portal(self, index: GroupIndex | None) -> None:
        leads = self.leads("city_volunteer_portal")
        opportunities: dict[str, list[dict[str, Any]]] = {}
        for lead in leads:
            if lead.get("kind_hint") == "opportunity":
                opportunities.setdefault(
                    str((lead.get("extra") or {}).get("agency_id")), []
                ).append(lead)
        for lead in leads:
            if lead.get("kind_hint") != "program":
                continue
            if lead["name"].endswith("Philly Reading Coaches"):
                self._portal_duplicate(lead, index)
                continue
            agency = str((lead.get("extra") or {}).get("agency_id") or lead["native_id"])
            opps = opportunities.get(agency, [])
            node = make_node(lead)
            school = re.sub(r"^Community Schools\s*@\s*", "", lead["name"]).strip()
            summary = _pick(SCHOOL_SUMMARIES, lead["lead_id"]).format(school=school)
            if lead["name"] == "Community Schools Special Projects":
                summary = (
                    "Community Schools Special Projects lists one time and short term volunteer "
                    "projects at the City's Community Schools, posted on the City's volunteer "
                    "portal."
                )
            requirements = sorted(
                {r for o in opps for r in (o.get("extra") or {}).get("requirements") or []}
            )
            record = self.layer_record(
                "school",
                [node],
                summary=summary,
                what_you_do=_pick(SCHOOL_DOING, lead["lead_id"]),
                name=lead["name"],
                label="School",
            )
            record["contacts"] = {k: lead.get(k) for k in ("email", "phone") if lead.get(k)} | {
                "website": lead["source_url"]
            }
            record["requirements"] = _portal_requirements(requirements)
            min_age = _min_age_from_requirements(requirements)
            if min_age:
                record["audience"]["min_age"] = min_age
            needs = [
                r.removeprefix("Requires: ") for r in requirements if r.startswith("Requires:")
            ]
            if needs:
                record["first_step"] = {
                    "what_to_expect": "Volunteers are asked for: " + "; ".join(needs) + ".",
                }
            record["sources"][0]["fields"] = sorted(
                {*record["sources"][0]["fields"], "contacts.website"}
            )
            self._add("city-volunteer-portal", record, "City Community Schools volunteer portal")

    def _portal_duplicate(self, lead: dict[str, Any], index: GroupIndex | None) -> None:
        survivor = index.by_lead.get("city_programs:philly-reading-coaches") if index else None
        if not survivor:
            self._skip("portal: Philly Reading Coaches duplicate (run fyj merge first)")
            return
        self._add(
            "city-volunteer-portal",
            {
                "match": {
                    "lead_ids": [lead["lead_id"]],
                    "group_id": survivor,
                    "ein": None,
                    "website": None,
                },
                "verdict": "duplicate",
                "name": lead["name"],
                "sources": [{"url": lead["source_url"], "seen": self.today, "fields": ["name"]}],
                "research_tier": 1,
            },
            "City Community Schools volunteer portal",
        )

    # -- the hand researched City programs ------------------------------------------------------

    def programs(self) -> None:
        seed_path = self.layout.seeds_dir / "city_programs.yaml"
        if not seed_path.exists():
            return
        entries = (yaml.safe_load(seed_path.read_text(encoding="utf-8")) or {}).get("programs", [])
        lead_ids = {lead["name"]: lead["lead_id"] for lead in self.leads("city_programs")}
        for entry in entries:
            name = entry["name"]
            if name in PROGRAMS_SKIPPED:
                self._skip(f"program skipped: {PROGRAMS_SKIPPED[name]}")
                continue
            profile = PROGRAM_PROFILES.get(name)
            if profile is None or name not in lead_ids:
                self._skip("program without a hand mapping")
                continue
            self._add(
                "city-programs",
                self._program_record(entry, profile, lead_ids[name]),
                "City volunteer programs from data/seeds/city_programs.yaml",
            )

    def _program_record(
        self, entry: dict[str, Any], profile: dict[str, Any], lead_id: str
    ) -> dict[str, Any]:
        evidence = entry.get("evidence_date")
        evidence_month = str(evidence)[:7] if evidence and len(str(evidence)) >= 7 else None
        what = " ".join(str(entry.get("what") or "").split())
        clearances = " ".join(str(entry.get("clearances") or "").split())
        training = " ".join(str(entry.get("training") or "").split())
        who = " ".join(str(entry.get("who_can_join") or "").split())
        # Evidence we could not read ourselves: a page we never fetched, or a date we do not have.
        weak = (
            evidence_month is None
            or "reported" in who
            or "not confirmed" in who
            or "indexed search" in str(entry.get("notes") or "")
        )
        status, last = "unknown", None
        if evidence_month:
            age = month_diff(evidence_month, self.month)
            status = "active" if age <= 12 else "probably_active" if age <= 24 else "dormant"
            last = evidence_month
            if status == "dormant" and not weak:
                # The City page was live when we read it on the research pass, and nothing says
                # the program ended; only its own last update is old. That is a working page with
                # undated current evidence, which the status rules call probably active.
                status = "probably_active"
        known_clearances = bool(clearances) and not re.match(
            r"(none|unknown|n/a)", clearances, re.I
        )
        known_training = bool(training) and not re.match(r"(unknown|n/a)", training, re.I)
        expect: list[str] = []
        if known_training:
            expect.append(f"Training: {training}.".replace("..", "."))
        if known_clearances:
            expect.append(f"Clearances: {clearances}.".replace("..", "."))
        if entry.get("signup_url"):
            how = f"Use the sign up form at {entry['signup_url']}."
        else:
            how = None
        audience: dict[str, Any] = {"open_to": profile.get("open_to", "public")}
        age_range = _ages_from_text(who)
        if age_range[0] is not None:
            audience["min_age"] = age_range[0]
        if age_range[1] is not None:
            audience["max_age"] = age_range[1]
        record: dict[str, Any] = {
            "match": {"lead_ids": [lead_id], "group_id": None, "ein": None, "website": None},
            "verdict": "publish",
            "name": entry["name"],
            "kind": self.kind("program"),
            "summary": SUMMARY_OVERRIDES.get(entry["name"], what),
            **self.vocab_fields(profile),
            "audience": audience,
            "schedule": {"text": profile.get("schedule"), "season": profile.get("season")},
            "requirements": _program_requirements(clearances if known_clearances else ""),
            "contacts": {"website": entry["url"]},
            "status": status,
            "last_sign_of_life": last,
            "sign_of_life_url": entry["url"] if last else None,
            "sources": [
                {
                    "url": entry["url"],
                    "seen": PROGRAMS_SEEN,
                    "fields": ["name", "summary", "audience", "requirements"],
                }
            ],
            "research_tier": 1,
            "confidence": "low" if weak else "medium",
        }
        if profile.get("commitment"):
            record["commitment"] = profile["commitment"]
        first_step: dict[str, Any] = {}
        if how:
            first_step["how"] = how
            first_step["sign_up_needed"] = True
        if expect:
            first_step["what_to_expect"] = " ".join(expect)
        if first_step:
            record["first_step"] = first_step
        return record

    # -- run ---------------------------------------------------------------------------------

    def run(self, only: set[str] | None = None) -> Generated:
        index = (
            GroupIndex.build(GroupStore(self.layout.groups_dir))
            if self.layout.groups_dir.exists()
            else None
        )
        list_keys = {key for key, *_ in self.LISTS}
        if only is None or only & list_keys:
            self.city_lists(index, only)
        if only is None or "programs" in only:
            self.programs()
        if only is None or "portal" in only:
            self.portal(index)
        return self.out


def _portal_requirements(requirements: list[str]) -> dict[str, Any]:
    text = " ".join(requirements)
    out: dict[str, Any] = {}
    if re.search(r"child abuse", text, re.I):
        out["act153_clearances"] = True
    if re.search(r"criminal background|fbi|fingerprint", text, re.I):
        out["background_check"] = True
    return out


def _program_requirements(clearances: str) -> dict[str, Any]:
    return _portal_requirements([clearances]) if clearances else {}


def _min_age_from_requirements(requirements: list[str]) -> int | None:
    ages = [int(m.group(1)) for r in requirements if (m := re.match(r"(\d{1,2}) and older", r))]
    return min(ages) if ages else None


def _ages_from_text(text: str) -> tuple[int | None, int | None]:
    if m := re.search(r"\b(\d{1,2}) or older\b", text):
        return int(m.group(1)), None
    if m := re.search(r"\b(\d{1,2}) to (\d{1,2}) years? old\b", text):
        return int(m.group(1)), int(m.group(2))
    return None, None


def generate(
    layout: Layout,
    vocab: Vocab,
    *,
    today: str | None = None,
    locator: Any = None,
    only: set[str] | None = None,
) -> Generated:
    today = today or _dt.date.today().isoformat()
    return Builder(layout, vocab, today, locator).run(only)


def write_inbox_files(layout: Layout, generated: Generated, wave: str = WAVE) -> list[str]:
    folder = layout.inbox_dir(wave)
    folder.mkdir(parents=True, exist_ok=True)
    written = []
    for agent, payload in sorted(generated.files.items()):
        payload = {**payload, "wave": wave}
        path = folder / f"{agent}.json"
        path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(f"{agent}: {len(payload['records'])} record(s)")
    return written
