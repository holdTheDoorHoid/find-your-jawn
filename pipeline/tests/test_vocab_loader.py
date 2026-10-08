from fyj.vocab import load_vocab


def test_fixture_vocabulary_loads(vocab):
    assert "outdoors-adventure" in vocab.families
    assert vocab.tags["caving"] == "outdoors-adventure"
    assert {"values", "social"} <= vocab.simple["motives"]
    assert "all_adults" in vocab.simple["audiences"]
    assert vocab.zip_districts["19104"] == "west"
    assert vocab.neighborhoods["fairmount"]["planning_district"] == "lower_north"


def test_synonyms_map_to_tag_ids(vocab):
    assert vocab.resolve_tag("Spelunking") == "caving"
    assert vocab.resolve_tag("cave exploring") == "caving"
    assert vocab.resolve_tag("caving") == "caving"
    assert vocab.resolve_tag("Civic-Engagement") == "civic_engagement"
    assert vocab.resolve_tag("basketweaving") is None


def test_families_and_other_lists_resolve_loosely(vocab):
    assert vocab.resolve_family("Outdoors & Adventure") == "outdoors-adventure"
    assert vocab.resolve_family("outdoors_adventure") == "outdoors-adventure"
    assert vocab.resolve_simple("motives", "Social") == "social"
    assert vocab.resolve_simple("kinds", "Friends Group") == "friends_group"
    assert vocab.resolve_district("Lower North") == "lower_north"


def test_missing_vocabulary_is_empty_not_an_error(tmp_path):
    vocab = load_vocab(tmp_path / "nothing")
    assert vocab.families == {}
    # kinds, motives and roles fall back to the lists DATA_MODEL spells out
    assert "club" in vocab.simple["kinds"]


def test_other_file_layouts_are_accepted(tmp_path):
    (tmp_path / "interests.yaml").write_text(
        "families:\n"
        "  outdoors-adventure:\n"
        "    label: Outdoors\n"
        "    tags:\n"
        "      caving: {aka: [spelunking]}\n"
        "      hiking: Hiking\n"
        "tags:\n"
        "  - {id: birding, family: outdoors-adventure, aka: [bird watching]}\n",
        encoding="utf-8",
    )
    (tmp_path / "motives.yaml").write_text("- values\n- social\n", encoding="utf-8")
    (tmp_path / "formats.yaml").write_text(
        "side_by_side: {label: x}\nlearn_skill: {}\n", encoding="utf-8"
    )
    vocab = load_vocab(tmp_path)
    assert vocab.tags["caving"] == "outdoors-adventure"
    assert vocab.resolve_tag("spelunking") == "caving"
    assert vocab.resolve_tag("Bird Watching") == "birding"
    assert vocab.simple["motives"] >= {"values", "social"}
    assert vocab.simple["formats"] == {"side_by_side", "learn_skill"}


def test_find_tags_searches_ids_and_synonyms(vocab):
    assert "caving" in vocab.find_tags("spelunk")
    assert "library_programs" in vocab.find_tags("library")


def test_audiences_file_sections_and_the_zip_table_are_read(vocab):
    assert {"all_adults", "seniors"} <= vocab.simple["audiences"]
    assert "public" in vocab.simple["open_to"]
    assert vocab.simple["community"] == {"lgbtq", "veterans", "women"}
    assert vocab.simple["languages"] == {"en", "es"}
    assert vocab.resolve_simple("languages", "Spanish") == "es"
    assert vocab.resolve_simple("faith", "Catholic") == "catholic"
    assert vocab.zip_districts["19101"] == "central"  # from the unverified table
    assert vocab.neighborhoods["university_city"]["planning_district"] == "west"
    assert vocab.support_families == {"support-recovery"}
