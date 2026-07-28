# 3DVerse

3DVerse is a marketplace connecting 3D creators, customers, and manufacturing/print partners.

## Architecture

- **Frontend:** Next.js + React + TypeScript + Tailwind CSS (in `/frontend`)
- **Backend:** FastAPI (Python) (in `/backend`)
- **Database:** PostgreSQL
- **Cache/Queue:** Redis

## Setup

1. **Infrastructure**:
   ```bash
   docker-compose up -d
   ```
2. **Backend**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload
   ```
3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Optional data scripts (`backend/scripts/`)

Not run automatically -- use only if you want this data locally:
- `seed_demo.py` -- demo creators/products/orders/reviews (logins: `maya@3dverse.demo` / `arjun@3dverse.demo`, password `password123`)
- `seed_materials.py` -- the platform Material catalog (PLA, ABS, etc.)
- `seed_collaboration.py` -- sample print-partner collaboration tickets
- `generate_embeddings.py` -- backfill search embeddings for any product missing one

Run from `backend/` with the venv active, e.g. `python scripts/seed_demo.py`.

## Roles

- **Creator**: Can upload 3D models and sell digital/physical prints.
- **Customer**: Can buy models and order prints.
- **Print Partner**: Fulfills print-on-demand orders.
- **Admin**: Manages the platform.

## Phase 1 Implementation (Finished)
- Initial Monorepo Setup
- Docker-compose for Postgres & Redis
- FastAPI User Authentication Flow (JWT, Users Table)
- Next.js scaffolding with Login & Register pages

## Phase 2 Implementation (Finished)
- Creator Dashboard UI
- 3D Model File Uploads (.stl, .obj, .3mf, .step, .fbx, .blend)
- Live 3D Model Preview using Three.js / React Three Fiber
- Product Media (Images/Videos) Management

## Phase 3 Implementation (Finished)
- Asynchronous Task Queue using Celery + Redis
- Automated Printability Analysis for uploaded 3D Models
- Printability Report generation (Pass/Warning/Fail, volume & dimensions)

## Phase 4 Implementation (Finished)
- Product Publishing Pipeline (requires passing Printability Report)
- Configurable Product Modes (Digital Downloads, Physical Prints, Customizable Merch)
- JSON-schema based configuration for Mode 4 (Customizable Fields)
- Creator UI for toggling modes and configuring product specific settings

## Phase 5 Implementation (Finished)
- Customer Marketplace Homepage (Featured, Trending, New Arrivals, Categories)
- Product Listing & Detail Pages with integrated 3D Model Preview
- Full-text search (Postgres tsvector) with dynamic filtering (Category, Price range)
- Customer Wishlist API & UI functionality
- Review System (Ratings & Text), gated to verified purchasers

## Phase 6 Implementation (Finished)
- Cart model and APIs (add, remove, update quantity)
- Coupon system (flat & percentage discounts, usage limits)
- Checkout flow with Stripe Payment Intents integration (Test Mode)
- Order & OrderItem models with automated confirmation logic
- Simple HTML-to-PDF invoice generation (using reportlab) available in Order History

## Phase 7 Implementation (Finished)
- Print Partner role dashboard and incoming job queue
- Print-partner assignment logic via basic pincode matching
- Shiprocket API integration (mocked) for generating shipping labels
- Order status timeline component on the customer order page

## Phase 8 Implementation (Finished)
- AI Intelligence Layer integrated with `pgvector`
- Natural-language product search via hybrid search (keyword + semantic) using `sentence-transformers`
- "Similar products" AI recommendation engine on the product detail page based on embedding cosine similarity
- *(Note: Support Chatbot module was intentionally skipped as per project requirements)*

## Phase 9 Implementation (Finished)
- Analytics & Business Intelligence Layer tapping live Postgres data
- Role-specific API endpoints (`/api/analytics/creator` & `/api/analytics/admin`) with dynamic date filtering
- Interactive Creator BI Dashboard charting live revenue trends over time using `recharts`
- Dedicated Admin Platform visualising global user growth, physical vs digital sales volume, and overall marketplace health
