from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def make_alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


@pytest.mark.postgresql
def test_empty_migration_framework_runs_to_head(postgresql_url: str) -> None:
    config = make_alembic_config(postgresql_url)
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == []

    command.upgrade(config, "head")

    engine = create_engine(postgresql_url)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            assert context.get_current_revision() is None
    finally:
        engine.dispose()

