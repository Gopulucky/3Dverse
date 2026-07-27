import logging
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import sys
import os

# add app directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base
from app.models.user import User
from app.models.creator import Creator
from app.models.notification import Notification
from app.models.product import Product, ProductVersion, ProductMedia, PrintabilityReport
from app.models.wishlist import Wishlist
from app.models.review import Review
from app.models.cart import Cart, CartItem
from app.models.coupon import Coupon
from app.models.order import Order, OrderItem
from app.models.printer import PrinterProfile
from app.models.material import Material, CreatorMaterial, FinishOption, PostProcessCapability
from app.models.defect_report import DefectReport
from app.models.print_partner import PrintPartner
from app.models.filament_spool import FilamentSpool, ProductFilamentRequirement, ProductionLog
from app.models.collaboration import CollaborationTicket, CertificationReport, CollaborationMessage, CollaborationAgreement
from app.models.printer_assumption import PrinterAssumption
from app.models.reward_ledger import RewardLedger
from app.models.ad_campaign import AdCampaign
from app.models.stock import StockItem, StockMovement
from app.models.return_request import ReturnRequest

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# overwrite sqlalchemy.url with the one from our settings
config.set_main_option("sqlalchemy.url", settings.SQLALCHEMY_DATABASE_URI.replace("%", "%%"))

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.SQLALCHEMY_DATABASE_URI
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
