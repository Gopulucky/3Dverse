"""Seed the platform Material catalog with common 3D printing materials.

Run (from backend/):  python scripts/seed_materials.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.user import User  # noqa: F401 — needed for relationship resolution
from app.models.printer import Printer  # noqa: F401
from app.models.material import Material, MaterialCategory

MATERIALS = [
    {
        "name": "PLA",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM"],
        "properties": {"strength": "medium", "flexibility": "low", "ease_of_print": "high", "layer_adhesion": "good"},
        "min_wall_thickness": 0.8,
        "max_temp": 60,
        "density": 1.24,
        "color_options": ["White", "Black", "Red", "Blue", "Green", "Yellow", "Orange", "Gray", "Natural"],
        "food_safe": False,
        "recyclable": True,
        "description": "Most popular FDM filament. Easy to print, biodegradable, great for prototypes and decorative prints.",
    },
    {
        "name": "ABS",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM"],
        "properties": {"strength": "high", "flexibility": "medium", "ease_of_print": "medium", "heat_resistance": "good"},
        "min_wall_thickness": 1.0,
        "max_temp": 100,
        "density": 1.04,
        "color_options": ["White", "Black", "Red", "Blue", "Gray", "Natural"],
        "food_safe": False,
        "description": "Strong, durable, heat-resistant. Requires heated bed and enclosure. Good for functional parts.",
    },
    {
        "name": "PETG",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM"],
        "properties": {"strength": "high", "flexibility": "medium", "ease_of_print": "medium", "chemical_resistance": "good"},
        "min_wall_thickness": 0.8,
        "max_temp": 80,
        "density": 1.27,
        "color_options": ["Clear", "White", "Black", "Blue", "Red", "Green"],
        "food_safe": True,
        "description": "Great balance of strength and printability. Food-safe options available. Good chemical resistance.",
    },
    {
        "name": "TPU",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM"],
        "properties": {"strength": "medium", "flexibility": "very_high", "ease_of_print": "low", "abrasion_resistance": "high"},
        "min_wall_thickness": 1.2,
        "max_temp": 60,
        "density": 1.21,
        "color_options": ["White", "Black", "Clear", "Red", "Blue"],
        "description": "Flexible rubber-like material. Great for phone cases, gaskets, wearables.",
    },
    {
        "name": "Nylon (PA)",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM", "SLS"],
        "properties": {"strength": "very_high", "flexibility": "medium", "ease_of_print": "low", "wear_resistance": "excellent"},
        "min_wall_thickness": 0.8,
        "max_temp": 180,
        "density": 1.14,
        "color_options": ["Natural", "White", "Black"],
        "description": "Engineering-grade material. Extremely strong and durable. Ideal for functional parts and gears.",
    },
    {
        "name": "Standard Resin",
        "category": MaterialCategory.resin,
        "technology_compatibility": ["SLA", "DLP"],
        "properties": {"strength": "medium", "detail": "very_high", "ease_of_print": "high", "surface_finish": "excellent"},
        "min_wall_thickness": 0.5,
        "max_temp": 50,
        "density": 1.10,
        "color_options": ["Gray", "White", "Black", "Clear", "Beige"],
        "description": "High detail resin for miniatures, jewelry masters, and detailed prototypes.",
    },
    {
        "name": "Tough Resin",
        "category": MaterialCategory.resin,
        "technology_compatibility": ["SLA", "DLP"],
        "properties": {"strength": "high", "detail": "high", "impact_resistance": "high"},
        "min_wall_thickness": 0.6,
        "max_temp": 60,
        "density": 1.15,
        "color_options": ["Gray", "Green", "Black"],
        "description": "ABS-like resin. Combines high detail with impact resistance for functional prototypes.",
    },
    {
        "name": "Nylon PA12 (SLS)",
        "category": MaterialCategory.powder,
        "technology_compatibility": ["SLS", "MJF"],
        "properties": {"strength": "very_high", "flexibility": "medium", "chemical_resistance": "good", "isotropic": True},
        "min_wall_thickness": 0.7,
        "max_temp": 150,
        "density": 1.01,
        "color_options": ["White", "Gray", "Black"],
        "description": "Industrial-grade SLS powder. No support structures needed. Ideal for production parts.",
    },
    {
        "name": "ASA",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM"],
        "properties": {"strength": "high", "uv_resistance": "excellent", "ease_of_print": "medium"},
        "min_wall_thickness": 1.0,
        "max_temp": 100,
        "density": 1.07,
        "color_options": ["White", "Black", "Gray", "Blue"],
        "uv_stable": True,
        "description": "UV-resistant alternative to ABS. Ideal for outdoor applications.",
    },
    {
        "name": "Carbon Fiber PLA",
        "category": MaterialCategory.filament,
        "technology_compatibility": ["FDM"],
        "properties": {"strength": "very_high", "stiffness": "very_high", "weight": "light"},
        "min_wall_thickness": 1.0,
        "max_temp": 60,
        "density": 1.15,
        "color_options": ["Black"],
        "description": "Carbon fiber reinforced PLA. Extremely stiff and lightweight. Requires hardened nozzle.",
    },
]


def seed_materials():
    db = SessionLocal()
    try:
        existing = db.query(Material).count()
        if existing > 0:
            print(f"Materials table already has {existing} entries. Skipping seed.")
            return

        for mat_data in MATERIALS:
            material = Material(**mat_data)
            db.add(material)

        db.commit()
        print(f"Seeded {len(MATERIALS)} materials successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_materials()
