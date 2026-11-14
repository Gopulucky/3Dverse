from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

# Keep in step with frontend/src/lib/waitlist.ts.
Interest = Literal["personalised_gifts", "tabletop", "home_decor", "cosplay", "other"]
PriceChoice = Literal["299", "499", "799", "unsure"]


class WaitlistJoin(BaseModel):
    email: EmailStr
    interest: Interest
    price_choice: Optional[PriceChoice] = None
    city: Optional[str] = Field(default=None, max_length=80)
    source: Literal["home", "printed_catalogue"] = "home"
    # The visitor ticked "email me when printed products launch" (DPDP: consent for this purpose only).
    consent: Literal[True]

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("city", mode="before")
    @classmethod
    def tidy_city(cls, value):
        if isinstance(value, str):
            value = " ".join(value.split())
            return value or None
        return value
