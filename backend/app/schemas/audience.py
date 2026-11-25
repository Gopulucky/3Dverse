import re
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# Keep these values in step with frontend/src/lib/audience.ts
# (scripts/machines/audience.test.mjs fails if they drift).
Role = Literal["student", "hobbyist", "professional", "parent", "business", "designer", "other"]
Use = Literal["gifts", "home_decor", "hobby", "college_project", "useful_parts", "my_shop", "sell_designs", "exploring"]
Occasion = Literal["birthday", "wedding", "festival", "corporate", "none"]
Printer = Literal["yes", "no", "planning"]
Personalise = Literal["always", "sometimes", "no"]
BoughtWhere = Literal["marketplace", "etsy_instagram", "local_shop", "made_it", "never"]
SpendBand = Literal["under_500", "500_1500", "1500_3000", "over_3000"]

ID = r"^[A-Za-z0-9_-]{8,64}$"


class AudienceAnswers(BaseModel):
    """What the popup sends after each step: everything answered so far (any field may be missing)."""

    response_id: str = Field(pattern=ID)
    anon_id: Optional[str] = Field(default=None, pattern=ID)
    step: int = Field(ge=1, le=4)
    role: Optional[Role] = None
    city: Optional[str] = Field(default=None, max_length=80)
    uses: Optional[list[Use]] = Field(default=None, max_length=2)
    occasions: Optional[list[Occasion]] = Field(default=None, max_length=5)
    owns_printer: Optional[Printer] = None
    personalise: Optional[Personalise] = None
    bought_where: Optional[BoughtWhere] = None
    spend_band: Optional[SpendBand] = None
    missing: Optional[str] = Field(default=None, max_length=280)
    email: Optional[EmailStr] = None
    whatsapp: Optional[str] = None
    chat_ok: Optional[bool] = None
    # The visitor agreed to be contacted (DPDP: consent for this purpose only).
    consent: Optional[bool] = None

    @field_validator("city", "missing", mode="before")
    @classmethod
    def tidy_text(cls, value):
        if isinstance(value, str):
            value = " ".join(value.split())
            return value or None
        return value

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()
            return value or None
        return value

    @field_validator("whatsapp", mode="before")
    @classmethod
    def indian_mobile(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        digits = re.sub(r"[\s()-]", "", str(value))
        if digits.startswith("+91"):
            digits = digits[3:]
        elif len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not re.fullmatch(r"[6-9][0-9]{9}", digits):
            raise ValueError("Enter a valid Indian mobile number")
        return digits

    @field_validator("uses", "occasions")
    @classmethod
    def no_repeats(cls, value):
        if value is not None and len(set(value)) != len(value):
            raise ValueError("Choose each option once")
        return value

    @model_validator(mode="after")
    def contact_needs_consent(self):
        if (self.email or self.whatsapp or self.chat_ok) and self.consent is not True:
            raise ValueError("Contact details need the visitor's consent")
        return self
