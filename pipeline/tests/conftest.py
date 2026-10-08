from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


def load_fixture(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


@pytest.fixture
def layout(tmp_path):
    """A temporary repository layout with the fixture vocabulary installed."""
    import shutil

    from fyj.paths import Layout

    root = tmp_path / "repo"
    (root / "data").mkdir(parents=True)
    shutil.copytree(FIXTURES_DIR / "vocab", root / "data" / "vocab")
    return Layout(root=root)


@pytest.fixture
def vocab(layout):
    from fyj.vocab import load_vocab

    return load_vocab(layout.vocab_dir)
