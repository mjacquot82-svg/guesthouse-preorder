from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CloverInstallation(Base):
    __tablename__ = "clover_installations"

    merchant_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    environment: Mapped[str] = mapped_column(String(20), primary_key=True)
    app_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text)
    access_token_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
