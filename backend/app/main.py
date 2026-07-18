from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routers import auth, products, marketplace, wishlist, reviews, cart, checkout, orders, partner, analytics, notifications, creator, creator_printers, creator_materials
from app.core.config import settings
from app.core.database import Base, engine
import os

# For initial testing without alembic if desired, but we will use alembic.
import os
import traceback
from fastapi.responses import PlainTextResponse

from contextlib import asynccontextmanager

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
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print("GLOBAL EXCEPTION:", traceback.format_exc())
    with open("error_log.txt", "w") as f:
        f.write(traceback.format_exc())
    return PlainTextResponse(str(traceback.format_exc()), status_code=500)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Serve static files from 'uploads' directory
uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
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
app.include_router(creator_printers.router, prefix=f"{settings.API_V1_STR}/creator/printers", tags=["creator-printers"])
app.include_router(creator_materials.router, prefix=f"{settings.API_V1_STR}/creator/materials", tags=["creator-materials"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the 3DVerse API"}
