from fastapi import APIRouter

from app.api.v1.catalog import router as catalog_router
from app.api.v1.clover import router as clover_router
from app.api.v1.orders import router as orders_router
from app.api.v1.owner_auth import router as owner_auth_router

router = APIRouter(prefix="/api/v1")
router.include_router(catalog_router)
router.include_router(orders_router)
router.include_router(clover_router)
router.include_router(owner_auth_router)
