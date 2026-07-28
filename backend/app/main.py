from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routers import auth, products, marketplace, wishlist, reviews, cart, checkout, orders, partner, analytics, notifications, creator, creator_materials, financial_metrics, admin_metrics, ads, export, admin, onboarding, designer, collaboration, commissions, users, downloads, stock
from app.core.config import settings
from app.core.database import Base, engine
import logging
import os

from fastapi.responses import JSONResponse

from contextlib import asynccontextmanager

logger = logging.getLogger("3dverse")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.core.redis import redis_client
    await redis_client.connect()
    yield
    # Shutdown
    await redis_client.disconnect()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    # The interactive schema/docs describe every internal endpoint; keep them
    # available in dev but not handed out publicly in production.
    openapi_url=None if settings.is_production else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan
)

# Registered before CORSMiddleware so it ends up *inside* it: an unhandled
# exception that escapes to Starlette's own error handler produces a 500 that
# never passes back through CORS, so the browser reports a real server crash as
# a misleading "No 'Access-Control-Allow-Origin' header" error. Converting it to
# a response here means the 500 gets CORS headers and the real status is visible.
@app.middleware("http")
async def catch_unhandled_errors(request, call_next):
    try:
        return await call_next(request)
    except Exception:
        # Log the full trace server-side; never return it to the caller, since
        # it exposes file paths, SQL, and internal structure to anyone who can
        # trigger an error.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.middleware("http")
async def no_sniff(request, call_next):
    # Belt-and-suspenders alongside the upload-time extension/magic-byte
    # checks: even if a mislabeled file ever made it to disk, this stops a
    # browser from content-sniffing it into something other than what its
    # Content-Type says (the classic route to stored XSS via file upload).
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

# Only genuinely public assets are served statically. Model files, submitted
# designs, sample photos and invoices are paid or private and are served through
# /api/downloads, which checks entitlement per request.
uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
PUBLIC_UPLOAD_SUBFOLDERS = ["media", "images", "avatars", "portfolio"]
for subfolder in PUBLIC_UPLOAD_SUBFOLDERS:
    path = os.path.join(uploads_dir, subfolder)
    os.makedirs(path, exist_ok=True)
    app.mount(f"/uploads/{subfolder}", StaticFiles(directory=path), name=f"uploads-{subfolder}")

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(products.router, prefix=f"{settings.API_V1_STR}/products", tags=["products"])
app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["marketplace"])
app.include_router(wishlist.router, prefix=f"{settings.API_V1_STR}/wishlist", tags=["wishlist"])
app.include_router(reviews.router, prefix=f"{settings.API_V1_STR}/reviews", tags=["reviews"])
app.include_router(cart.router, prefix=f"{settings.API_V1_STR}/cart", tags=["cart"])
app.include_router(checkout.router, prefix=f"{settings.API_V1_STR}/checkout", tags=["checkout"])
app.include_router(orders.router, prefix=f"{settings.API_V1_STR}/orders", tags=["orders"])
app.include_router(partner.router, prefix=f"{settings.API_V1_STR}/partner", tags=["partner"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])
app.include_router(creator.router, prefix=f"{settings.API_V1_STR}/creator", tags=["creator"])
app.include_router(creator_materials.router, prefix=f"{settings.API_V1_STR}/creator/materials", tags=["creator-materials"])
app.include_router(financial_metrics.router, prefix=f"{settings.API_V1_STR}/creator/financial", tags=["financial-metrics"])
app.include_router(admin_metrics.router, prefix=f"{settings.API_V1_STR}/admin/financial", tags=["admin-metrics"])
app.include_router(ads.router, prefix=f"{settings.API_V1_STR}/creator/ads", tags=["ads"])
app.include_router(export.router, prefix=f"{settings.API_V1_STR}/export", tags=["export"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin/management", tags=["admin-management"])
app.include_router(onboarding.router, prefix=f"{settings.API_V1_STR}")
app.include_router(designer.router, prefix=f"{settings.API_V1_STR}")
app.include_router(collaboration.router, prefix=f"{settings.API_V1_STR}/collaboration", tags=["collaboration"])
app.include_router(commissions.router, prefix=f"{settings.API_V1_STR}/custom-designs", tags=["custom-designs"])
app.include_router(downloads.router, prefix=f"{settings.API_V1_STR}/downloads", tags=["downloads"])
app.include_router(stock.router, prefix=f"{settings.API_V1_STR}/creator/stock", tags=["stock"])
@app.get("/")
def read_root():
    return {"message": "Welcome to the 3DVerse API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
