import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.schema import Table

from app.catalog import models as catalog_models  # noqa: F401
from app.db.base import Base

BACKEND_ROOT = Path(__file__).resolve().parents[2]
CATALOG_BASELINE_REVISION = "20260727_01"
CATALOG_TABLE_NAMES = frozenset(
    {
        "categories",
        "products",
        "product_variants",
        "modifier_groups",
        "modifier_options",
        "product_modifier_groups",
    }
)
LATER_MANAGED_TABLE_NAMES = frozenset(
    {
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
MANAGED_TABLE_NAMES = CATALOG_TABLE_NAMES | LATER_MANAGED_TABLE_NAMES
MIGRATION_LOCK_NAME = "guesthouse_preorder_alembic"


class MigrationBootstrapError(RuntimeError):
    pass


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def _type_signature(column_type: object, engine: Engine) -> str:
    return " ".join(str(column_type.compile(dialect=engine.dialect)).upper().split())


def _expected_check_names(table: Table) -> set[str]:
    prefix = f"ck_{table.name}_"
    return {
        (
            str(constraint.name)
            if str(constraint.name).startswith(prefix)
            else f"{prefix}{constraint.name}"
        )
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint) and constraint.name is not None
    }


def _validate_table(engine: Engine, table_name: str) -> list[str]:
    inspector = inspect(engine)
    expected = Base.metadata.tables[table_name]
    problems: list[str] = []

    actual_columns = {
        column["name"]: column for column in inspector.get_columns(table_name)
    }
    expected_columns = {column.name: column for column in expected.columns}
    if set(actual_columns) != set(expected_columns):
        problems.append(
            f"{table_name} columns are {sorted(actual_columns)}; expected "
            f"{sorted(expected_columns)}"
        )
    for column_name in sorted(set(actual_columns) & set(expected_columns)):
        actual_column = actual_columns[column_name]
        expected_column = expected_columns[column_name]
        actual_type = _type_signature(actual_column["type"], engine)
        expected_type = _type_signature(expected_column.type, engine)
        if actual_type != expected_type:
            problems.append(
                f"{table_name}.{column_name} type is {actual_type}; "
                f"expected {expected_type}"
            )
        if bool(actual_column["nullable"]) != bool(expected_column.nullable):
            problems.append(
                f"{table_name}.{column_name} nullable is "
                f"{actual_column['nullable']}; expected {expected_column.nullable}"
            )

    actual_primary_key = inspector.get_pk_constraint(table_name)
    expected_primary_key = expected.primary_key
    if (
        actual_primary_key.get("name") != expected_primary_key.name
        or list(actual_primary_key.get("constrained_columns") or [])
        != [column.name for column in expected_primary_key.columns]
    ):
        problems.append(f"{table_name} primary key does not match the baseline")

    actual_unique = {
        constraint["name"]: tuple(constraint["column_names"])
        for constraint in inspector.get_unique_constraints(table_name)
        if constraint.get("name")
    }
    expected_unique = {
        str(constraint.name): tuple(column.name for column in constraint.columns)
        for constraint in expected.constraints
        if isinstance(constraint, UniqueConstraint) and constraint.name is not None
    }
    for name, columns in expected_unique.items():
        if actual_unique.get(name) != columns:
            problems.append(
                f"{table_name} unique constraint {name} does not match the baseline"
            )

    actual_checks = {
        constraint["name"]
        for constraint in inspector.get_check_constraints(table_name)
        if constraint.get("name")
    }
    for name in _expected_check_names(expected):
        if name not in actual_checks:
            problems.append(
                f"{table_name} check constraint {name} is missing"
            )

    actual_foreign_keys = {
        constraint["name"]: (
            tuple(constraint["constrained_columns"]),
            constraint["referred_table"],
            tuple(constraint["referred_columns"]),
            (constraint.get("options") or {}).get("ondelete"),
        )
        for constraint in inspector.get_foreign_keys(table_name)
        if constraint.get("name")
    }
    expected_foreign_keys = {
        str(constraint.name): (
            tuple(element.parent.name for element in constraint.elements),
            constraint.elements[0].column.table.name,
            tuple(element.column.name for element in constraint.elements),
            constraint.ondelete,
        )
        for constraint in expected.constraints
        if isinstance(constraint, ForeignKeyConstraint)
        and constraint.name is not None
    }
    for name, signature in expected_foreign_keys.items():
        if actual_foreign_keys.get(name) != signature:
            problems.append(
                f"{table_name} foreign key {name} does not match the baseline"
            )

    actual_indexes = {
        index["name"]: (tuple(index["column_names"]), bool(index["unique"]))
        for index in inspector.get_indexes(table_name)
        if index.get("name") and not index.get("duplicates_constraint")
    }
    expected_indexes = {
        str(index.name): (
            tuple(column.name for column in index.columns),
            bool(index.unique),
        )
        for index in expected.indexes
        if index.name is not None
    }
    for name, signature in expected_indexes.items():
        if actual_indexes.get(name) != signature:
            problems.append(f"{table_name} index {name} does not match the baseline")

    return problems


def _validate_catalog_baseline(engine: Engine) -> None:
    problems = [
        problem
        for table_name in sorted(CATALOG_TABLE_NAMES)
        for problem in _validate_table(engine, table_name)
    ]
    if problems:
        formatted = "\n- ".join(problems)
        raise MigrationBootstrapError(
            "Existing catalog schema cannot be safely adopted as Alembic "
            f"revision {CATALOG_BASELINE_REVISION}:\n- {formatted}"
        )


def _current_revision(connection: Connection) -> str | None:
    return MigrationContext.configure(connection).get_current_revision()


def migrate_database(database_url: str | None = None) -> None:
    resolved_database_url = database_url or os.getenv("DATABASE_URL")
    if not resolved_database_url:
        raise MigrationBootstrapError("DATABASE_URL is required.")

    config = _alembic_config(resolved_database_url)
    engine = create_engine(resolved_database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(
                text("SELECT pg_advisory_lock(hashtext(:name))"),
                {"name": MIGRATION_LOCK_NAME},
            )
            try:
                revision = _current_revision(connection)
                if revision is not None:
                    print(f"Alembic revision {revision} found; upgrading to head.")
                    command.upgrade(config, "head")
                    return

                existing_tables = set(inspect(connection).get_table_names())
                existing_managed_tables = existing_tables & MANAGED_TABLE_NAMES
                if not existing_managed_tables:
                    print("No managed tables found; creating schema from Alembic.")
                    command.upgrade(config, "head")
                    return

                if existing_managed_tables != CATALOG_TABLE_NAMES:
                    raise MigrationBootstrapError(
                        "Database has no Alembic revision and contains an "
                        "unsupported partial set of managed tables: "
                        f"{sorted(existing_managed_tables)}. No schema changes "
                        "were made."
                    )

                _validate_catalog_baseline(engine)
                print(
                    "Existing catalog schema matches Alembic revision "
                    f"{CATALOG_BASELINE_REVISION}; stamping baseline."
                )
                command.stamp(config, CATALOG_BASELINE_REVISION)
                command.upgrade(config, "head")
                print("Existing catalog data preserved; Alembic is at head.")
            finally:
                connection.execute(
                    text("SELECT pg_advisory_unlock(hashtext(:name))"),
                    {"name": MIGRATION_LOCK_NAME},
                )
    finally:
        engine.dispose()


def main() -> None:
    migrate_database()


if __name__ == "__main__":
    main()
