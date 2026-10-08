from fyj.textutil import (
    fix_dashes,
    has_dash_punctuation,
    is_shared_domain,
    ngram_set,
    normalize_name,
    shared_run,
    smart_title,
    website_domain,
)


def test_fix_dashes_rewrites_punctuation_dashes_to_commas():
    assert fix_dashes("Meets Thursdays — bring a friend") == "Meets Thursdays, bring a friend"
    assert fix_dashes("Trips – weekends only") == "Trips, weekends only"
    assert fix_dashes("Dues are low - about $20") == "Dues are low, about $20"
    assert fix_dashes("Friendly--and free") == "Friendly, and free"


def test_fix_dashes_turns_number_ranges_into_to():
    assert fix_dashes("Open 6–8 pm") == "Open 6 to 8 pm"
    assert fix_dashes("Open 6 - 8 pm") == "Open 6 to 8 pm"


def test_fix_dashes_leaves_hyphenated_words_alone():
    assert fix_dashes("A drop-in, all-ages group.") == "A drop-in, all-ages group."


def test_fix_dashes_leaves_nothing_behind():
    for text in ["a — b", "a–b c", "x -- y", "x - y", "tail —", "— head"]:
        assert not has_dash_punctuation(fix_dashes(text)), text


def test_normalize_name_ignores_case_punctuation_and_filler():
    a = normalize_name("The Friends of Clark Park, Inc.")
    b = normalize_name("FRIENDS OF CLARK PARK INC")
    assert a == b
    assert normalize_name("Mural Arts of Philadelphia") == normalize_name("Mural Arts")
    assert normalize_name("Philly Grotto") == normalize_name("Grotto")
    assert normalize_name("Fairmount Civic Assn") == normalize_name("Fairmount Civic Association")
    assert normalize_name("St. Mary's Church") == normalize_name("ST MARYS CHURCH")


def test_smart_title_fixes_all_caps_names_only():
    assert smart_title("WILLIAM & JEANNE WALSH SCHOLARSHIP FUND INC") == (
        "William & Jeanne Walsh Scholarship Fund Inc"
    )
    assert smart_title("FRIENDS OF THE LIBRARY") == "Friends of the Library"
    assert smart_title("NAACP PHILADELPHIA BRANCH") == "NAACP Philadelphia Branch"
    assert smart_title("Penn Clubs and More") == "Penn Clubs and More"
    assert smart_title("10TH WARD CIVIC") == "10th Ward Civic"


def test_website_domain_ignores_www_and_paths():
    assert website_domain("https://www.PhillyGrotto.org/about/") == "phillygrotto.org"
    assert website_domain("phillygrotto.org") == "phillygrotto.org"
    assert website_domain("http://sub.example.org/a?b=1") == "sub.example.org"
    assert website_domain("n/a") is None
    assert website_domain(None) is None


def test_shared_domains_never_identify_a_group():
    assert is_shared_domain("facebook.com")
    assert is_shared_domain("www.facebook.com".removeprefix("www."))
    assert is_shared_domain("sub.wixsite.com")
    assert is_shared_domain("phila.gov")
    assert not is_shared_domain("phillygrotto.org")


def test_shared_run_finds_eight_word_overlaps_only():
    source = ngram_set(
        ["we", "are", "a", "student", "group", "that", "consults", "for", "social", "impact"], 8
    )
    assert shared_run("We are a student group that consults for hire", source) == (
        "we are a student group that consults for"
    )
    assert shared_run("We are a student group that tutors", source) is None
