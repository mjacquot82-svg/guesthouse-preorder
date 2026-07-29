from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.availability import models as availability_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401
from app.clover import models as clover_models  # noqa: F401
from app.orders import models as order_models  # noqa: F401
from app.db.base import Base

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def make_alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


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
