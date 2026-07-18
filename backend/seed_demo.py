"""Seed realistic demo data: creators, published products with images,
versions + printability reports, reviews, and orders across recent weeks.

Run:  python seed_demo.py
Idempotent: skips if the demo marker user already exists.
Demo logins (password for all: password123):
  creator: maya@3dverse.demo   customer: arjun@3dverse.demo
"""
import os
import random
import sys
import uuid
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from PIL import Image, ImageDraw, ImageFont

import app.models.printer  # noqa: F401 — register mappers
import app.models.material  # noqa: F401
import app.models.notification  # noqa: F401
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.product import (
    Product, ProductStatus, ProductVersion, PrintabilityReport, ProductMedia,
)
from app.models.review import Review
from app.models.order import Order, OrderItem

random.seed(42)

UPLOADS = os.path.join(os.path.dirname(__file__), "uploads")
IMAGES_DIR = os.path.join(UPLOADS, "images")
MODELS_DIR = os.path.join(UPLOADS, "models")

CATEGORY_PALETTES = {
    "Tabletop": [(94, 53, 177), (26, 35, 126)],
    "Jewelry": [(216, 27, 96), (74, 20, 140)],
    "Cosplay": [(230, 81, 0), (130, 40, 10)],
    "Miniatures": [(0, 121, 107), (13, 71, 161)],
    "Home Decor": [(121, 85, 72), (33, 33, 33)],
    "Gadgets": [(69, 90, 100), (38, 50, 56)],
}

CREATORS = [
    ("maya@3dverse.demo", "Maya Iyer", "Voxel Forge Studio", "Tabletop terrain and dice towers, optimized for FDM."),
    ("dev@3dverse.demo", "Dev Patel", "PrintCraft Labs", "Functional gadgets and organizers with zero-support printing."),
    ("sana@3dverse.demo", "Sana Reddy", "Aurel Design Co", "Minimal jewelry and home decor with printable elegance."),
    ("kabir@3dverse.demo", "Kabir Shah", "Foundry Miniatures", "28mm miniatures and busts, pre-supported for resin."),
]

CUSTOMERS = [
    ("arjun@3dverse.demo", "Arjun Mehta"), ("nisha@3dverse.demo", "Nisha Rao"),
    ("rohit@3dverse.demo", "Rohit Verma"), ("lila@3dverse.demo", "Lila Thomas"),
    ("vikram@3dverse.demo", "Vikram Singh"), ("anaya@3dverse.demo", "Anaya Kapoor"),
    ("farhan@3dverse.demo", "Farhan Ali"), ("tara@3dverse.demo", "Tara Nair"),
]

PRODUCTS = [
    ("Modular Dice Tower", "Tabletop", 12.99, "A collapsible dice tower with dragon-scale detailing. Prints in 3 parts, no supports needed. Fits standard 7-die sets.", ["dice", "dnd", "tabletop"], True),
    ("Hex Terrain Tile Set", "Tabletop", 18.50, "24 interlocking hex tiles: forest, hills, water and ruins. Magnetize with 3mm x 2mm magnets for stable boards.", ["terrain", "wargaming"], False),
    ("Celtic Knot Pendant", "Jewelry", 6.99, "An intricate endless-knot pendant that prints flat and looks great in silk PLA. Bail fits 3mm cord.", ["pendant", "celtic"], True),
    ("Orbit Ring Stand", "Jewelry", 4.50, "A gyroscopic ring display stand with three nested rotating rings. A mesmerizing desk piece.", ["display", "rings"], False),
    ("Mandalorian Helmet (Wearable)", "Cosplay", 24.99, "Full-scale wearable helmet, split into 6 printable parts with alignment keys. Includes padding mount points.", ["helmet", "starwars"], True),
    ("Energy Sword Hilt", "Cosplay", 15.00, "Two-part collapsible sword hilt with hidden spring mechanism. Prints in PETG for durability.", ["prop", "sword"], False),
    ("Forest Dragon Bust", "Miniatures", 9.99, "A 120mm dragon bust with pre-supported resin files and a cut FDM version. Crisp scale detail.", ["dragon", "bust"], True),
    ("Goblin Raiders (x5)", "Miniatures", 7.50, "Five 28mm goblin raiders in dynamic poses. Pre-supported and test-printed at 0.05mm.", ["28mm", "rpg"], False),
    ("Wave Desk Organizer", "Home Decor", 8.99, "A flowing parametric organizer with phone slot, pen wells and a hidden drawer. Prints support-free.", ["desk", "organizer"], False),
    ("Voronoi Table Lamp", "Home Decor", 14.25, "An organic voronoi lampshade that throws stunning shadows. Fits E27 and B22 fittings.", ["lamp", "voronoi"], True),
    ("Cable Whale Clips (x8)", "Gadgets", 3.99, "Eight friendly whale-shaped cable clips. Adhesive-mount or screw-mount variants included.", ["cable", "desk"], False),
    ("Flexi Gecko Fidget", "Gadgets", 5.49, "Print-in-place articulated gecko with 42 joints. Zero assembly, endless fidgeting.", ["flexi", "fidget"], False),
]

REVIEW_TEXTS = [
    (5, "Printed perfectly first try. The detail is incredible for FDM."),
    (5, "Best purchase on this platform so far. Instructions were spot on."),
    (4, "Great model. Needed a brim on my printer but came out clean."),
    (5, "The pre-supported files saved me hours. Zero failed prints."),
    (4, "Really nice design. Slightly tight tolerances, scale to 101% and it's perfect."),
    (3, "Good model but the assembly guide could use more photos."),
    (5, "My kids love it. Printed three already in different colors."),
    (4, "Sliced without issues in Cura and PrusaSlicer. Recommended."),
]

MATERIALS = ["PLA", "PETG", "ABS", "Resin"]
COLORS = ["Black", "White", "Silver", "Red", "Galaxy Purple"]
SIZES = ["Small (75%)", "Standard", "Large (125%)"]


def make_image(title: str, category: str, path: str):
    w, h = 800, 800
    c1, c2 = CATEGORY_PALETTES[category]
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(h):
        t = y / h
        draw.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(c1, c2)))
    # decorative translucent facets
    for _ in range(7):
        x, y = random.randint(-100, w), random.randint(-100, h)
        r = random.randint(80, 260)
        draw.regular_polygon((x, y, r), n_sides=random.choice([3, 5, 6]),
                             rotation=random.randint(0, 359), fill=(255, 255, 255, 18))
    # layer-line motif
    for y in range(0, h, 14):
        draw.line([(0, y), (w, y)], fill=(0, 0, 0, 14))
    try:
        font = ImageFont.truetype("arialbd.ttf", 54)
        small = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        font = small = ImageFont.load_default()
    words = title.split()
    mid = (len(words) + 1) // 2
    lines = [" ".join(words[:mid]), " ".join(words[mid:])] if len(words) > 2 else [title]
    ty = h - 120 - 62 * (len(lines) - 1)
    draw.text((44, ty - 46), category.upper(), font=small, fill=(255, 255, 255, 160))
    for i, line in enumerate(lines):
        draw.text((44, ty + i * 62), line, font=font, fill=(255, 255, 255, 235))
    img.save(path, "PNG")


def seed():
    db = SessionLocal()
    if db.query(User).filter(User.email == CREATORS[0][0]).first():
        print("Demo data already seeded — nothing to do.")
        return

    os.makedirs(IMAGES_DIR, exist_ok=True)
    pw = get_password_hash("password123")

    creators = []
    for email, name, company, bio in CREATORS:
        u = User(email=email, full_name=name, company_name=company, bio=bio,
                 hashed_password=pw, role=UserRole.creator, onboarding_completed=True,
                 pincode="560001")
        db.add(u)
        creators.append(u)

    customers = []
    for email, name in CUSTOMERS:
        u = User(email=email, full_name=name, hashed_password=pw,
                 role=UserRole.customer, pincode="560001")
        db.add(u)
        customers.append(u)
    db.commit()

    stl_files = [f for f in os.listdir(MODELS_DIR) if f.endswith(".stl")] or []
    now = datetime.utcnow()
    products = []
    for i, (title, category, price, desc, tags, featured) in enumerate(PRODUCTS):
        creator = creators[i % len(creators)]
        created = now - timedelta(days=random.randint(20, 75))
        p = Product(
            title=title, description=desc, category=category, tags=tags,
            price=price, license_type="Personal Use", status=ProductStatus.published,
            creator_id=creator.id, created_at=created, published_at=created,
            is_featured=featured, mock_order_count=random.randint(5, 240),
            is_mode_2_active=True, digital_download_enabled=True,
            is_mode_3_active=(i % 3 != 2),
            available_materials=random.sample(MATERIALS, 2),
            available_colors=random.sample(COLORS, 3),
            available_sizes=SIZES,
            base_print_price=round(price * 1.8, 2),
            print_settings={"layer_height": "0.2mm", "infill": "15%", "supports": "none"},
        )
        db.add(p)
        db.flush()

        img_name = f"seed_{uuid.uuid4().hex[:12]}.png"
        make_image(title, category, os.path.join(IMAGES_DIR, img_name))
        db.add(ProductMedia(product_id=p.id, media_url=f"/uploads/images/{img_name}",
                            media_type="image", is_primary=True))

        if stl_files:
            stl = stl_files[i % len(stl_files)]
            size = os.path.getsize(os.path.join(MODELS_DIR, stl))
            v = ProductVersion(product_id=p.id, file_url=f"/uploads/models/{stl}",
                               file_name=f"{title.lower().replace(' ', '_')}.stl",
                               file_size=size, version_number=1, is_latest=True,
                               created_at=created)
            db.add(v)
            db.flush()
            dims = {"x": round(random.uniform(40, 180), 1),
                    "y": round(random.uniform(40, 180), 1),
                    "z": round(random.uniform(20, 160), 1)}
            db.add(PrintabilityReport(
                version_id=v.id, status="pass", issues=[],
                volume_mm3=round(dims["x"] * dims["y"] * dims["z"] * 0.22, 1),
                dimensions=dims))
        products.append(p)
    db.commit()

    # Reviews
    for p in products:
        for rating, text in random.sample(REVIEW_TEXTS, random.randint(3, 6)):
            reviewer = random.choice(customers)
            db.add(Review(user_id=reviewer.id, product_id=p.id, rating=rating,
                          text=text,
                          created_at=now - timedelta(days=random.randint(1, 40))))
    db.commit()

    # Orders across the last 45 days
    statuses = ["paid", "queued", "printing", "shipped", "delivered", "delivered"]
    for _ in range(70):
        customer = random.choice(customers)
        created = now - timedelta(days=random.uniform(0, 45))
        chosen = random.sample(products, random.randint(1, 2))
        subtotal = 0.0
        items = []
        for p in chosen:
            qty = random.randint(1, 2)
            subtotal += p.price * qty
            items.append((p, qty))
        shipping = 5.0
        o = Order(customer_id=customer.id, shipping_cost=shipping,
                  subtotal=round(subtotal, 2), total=round(subtotal + shipping, 2),
                  status=random.choice(statuses), created_at=created,
                  shipping_address={"line1": "42 Demo Lane", "city": "Bengaluru",
                                    "pincode": "560001"})
        db.add(o)
        db.flush()
        for p, qty in items:
            db.add(OrderItem(order_id=o.id, product_id=p.id,
                             price_at_purchase=p.price, quantity=qty))
    db.commit()
    print(f"Seeded {len(creators)} creators, {len(customers)} customers, "
          f"{len(products)} published products, reviews and 70 orders.")
    print("Login as maya@3dverse.demo / password123 to see the creator dashboard.")


if __name__ == "__main__":
    seed()
