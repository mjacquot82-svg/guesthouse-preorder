from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.availability import models as availability_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401
from app.clover import models as clover_models  # noqa: F401
from app.orders import models as order_models  # noqa: F401
from app.db.base import Base
from app.db.migrate import (
    MigrationBootstrapError,
    _alembic_config,
    migrate_database,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def make_alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_migration_config_preserves_percent_encoded_database_urls() -> None:
    database_url = (
        "postgresql+psycopg://postgres.project:p%40ss%25word@"
        "pooler.example.com:5432/postgres"
    )

    assert _alembic_config(database_url).get_main_option("sqlalchemy.url") == database_url


@pytest.mark.postgresql
def test_catalog_migration_upgrades_and_downgrades(postgresql_url: str) -> None:
    config = make_alembic_config(postgresql_url)
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == ["20260729_04"]

    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = create_engine(postgresql_url)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            assert context.get_current_revision() == "20260729_04"

        assert set(inspect(engine).get_table_names()) >= {
            "alembic_version",
            "categories",
            "products",
            "product_variants",
            "modifier_groups",
            "modifier_options",
            "product_modifier_groups",
            "business_settings",
            "business_hours",
            "business_closures",
            "product_availability",
            "product_availability_overrides",
            "orders",
            "order_items",
            "order_item_modifiers",
            "clover_installations",
        }

        command.downgrade(config, "base")
        assert set(inspect(engine).get_table_names()).isdisjoint(
            {
                "categories",
                "products",
                "product_variants",
                "modifier_groups",
                "modifier_options",
                "product_modifier_groups",
                "business_settings",
                "business_hours",
                "business_closures",
                "product_availability",
                "product_availability_overrides",
                "orders",
                "order_items",
                "order_item_modifiers",
                "clover_installations",
            }
        )
    finally:
        engine.dispose()

    command.upgrade(config, "head")


@pytest.mark.postgresql
def test_catalog_models_match_migration(postgresql_url: str) -> None:
    config = make_alembic_config(postgresql_url)
    command.upgrade(config, "head")

    engine = create_engine(postgresql_url)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(
                connection,
                opts={
                    "compare_type": True,
                    "target_metadata": Base.metadata,
                },
            )
            differences = compare_metadata(context, Base.metadata)
    finally:
        engine.dispose()

    assert differences == []


@pytest.mark.postgresql
def test_migration_bootstrap_adopts_existing_catalog_without_data_loss(
    postgresql_url: str,
) -> None:
    config = make_alembic_config(postgresql_url)
    command.downgrade(config, "base")
    command.upgrade(config, "20260727_01")

    engine = create_engine(postgresql_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO categories "
                    "(slug, name, is_published, sort_order) "
                    "VALUES ('existing-category', 'Existing Category', true, 0)"
                )
            )
            connection.execute(text("DROP TABLE alembic_version"))

        migrate_database(postgresql_url)

        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            assert context.get_current_revision() == "20260729_04"
            assert connection.scalar(
                text(
                    "SELECT name FROM categories "
                    "WHERE slug = 'existing-category'"
                )
            ) == "Existing Category"
    finally:
        engine.dispose()


@pytest.mark.postgresql
def test_migration_bootstrap_refuses_partial_unversioned_schema(
    postgresql_url: str,
) -> None:
    config = make_alembic_config(postgresql_url)
    command.downgrade(config, "base")
    engine = create_engine(postgresql_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE categories (id bigint PRIMARY KEY)"))

        with pytest.raises(MigrationBootstrapError, match="partial set"):
            migrate_database(postgresql_url)

        assert set(inspect(engine).get_table_names()) == {
            "alembic_version",
            "categories",
        }
    finally:
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE categories CASCADE"))
        engine.dispose()
        command.upgrade(config, "head")
