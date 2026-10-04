from fyj.harvest import HARVESTERS
from fyj.registry import load_sources


def test_registry_loads_and_every_harvester_has_an_entry():
    sources = load_sources()
    assert sources, "registry/sources.yaml should not be empty"
    ids = {source.id for source in sources}
    assert ids == set(HARVESTERS.keys()), (
        "registry/sources.yaml ids must exactly match fyj.harvest.HARVESTERS ids"
    )


def test_every_source_has_the_required_fields():
    for source in load_sources():
        assert source.name
        assert source.owner
        assert source.url
        assert source.access
        assert source.terms
        assert source.attribution
        assert isinstance(source.lead_only, bool)
        assert source.refresh
        assert source.harvester
