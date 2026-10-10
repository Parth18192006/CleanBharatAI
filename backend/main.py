import os
from fastapi.middleware.cors import CORSMiddleware
from io import BytesIO
import time

from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    UploadFile,
    File,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from PIL import Image, UnidentifiedImageError
from transformers import pipeline

from database import engine
from models import User, Complaint


# =========================
# APP AND AI MODEL
# =========================

app = FastAPI(title="CleanBharat AI API")

# Allow the React/Vite frontend to connect to FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading CleanBharat AI model...")

waste_classifier = pipeline(
    "image-classification",
    model="yangy50/garbage-classification",
)

print("CleanBharat AI model is ready!")


# =========================
# JWT SETTINGS
# =========================

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")
ALGORITHM = "HS256"


# =========================
# PASSWORD SETTINGS
# =========================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

security = HTTPBearer()


# =========================
# AUTHENTICATION
# =========================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        if "user_id" not in payload:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
            )

        return payload

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )


# =========================
# OFFICER / ADMIN PERMISSION
# =========================

def require_officer(current_user=Depends(get_current_user)):
    if current_user.get("role") not in ["officer", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only officers or admins can update complaint status",
        )

    return current_user


# =========================
# REQUEST MODELS
# =========================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "citizen"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ReportCreate(BaseModel):
    title: str
    description: str | None = None
    latitude: str
    longitude: str
    waste_type: str | None = None
    photo_url: str | None = None


class StatusUpdate(BaseModel):
    status: str


# =========================
# HOME
# =========================

@app.get("/")
def home():
    return {
        "message": "CleanBharat AI Backend is running",
    }


# =========================
# HEALTH CHECK
# =========================

@app.get("/health")
def health():
    try:
        with engine.connect():
            return {
                "status": "ok",
                "database": "connected",
                "ai_model": "loaded",
            }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )


# =========================
# REGISTER USER
# =========================

@app.post("/api/users")
def create_user(user: UserCreate):
    # Public registration is restricted to citizen accounts.
    if user.role != "citizen":
        raise HTTPException(
            status_code=403,
            detail="Public registration is limited to citizen accounts",
        )

    if len(user.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )

    with Session(engine) as session:
        new_user = User(
            email=user.email,
            password_hash=pwd_context.hash(user.password),
            role="citizen",
        )

        try:
            session.add(new_user)
            session.commit()
            session.refresh(new_user)
        except IntegrityError:
            session.rollback()
            raise HTTPException(
                status_code=409,
                detail="This email may already be registered",
            )

        return {
            "message": "User created successfully",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
        }


# =========================
# LOGIN
# =========================

@app.post("/api/login")
def login_user(user: UserLogin):
    with Session(engine) as session:
        existing_user = (
            session.query(User)
            .filter(User.email == user.email)
            .first()
        )

        if not existing_user or not pwd_context.verify(
            user.password,
            existing_user.password_hash,
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        token = jwt.encode(
            {
                "user_id": existing_user.id,
                "email": existing_user.email,
                "role": existing_user.role,
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "role": existing_user.role,
        }


# =========================
# CREATE CITIZEN REPORT
# =========================

@app.post("/api/reports")
def create_report(
    report: ReportCreate,
    current_user=Depends(get_current_user),
):
    complaint_id = (
        f"CB-{current_user['user_id']}-"
        f"{int(time.time() * 1000000)}"
    )

    with Session(engine) as session:
        new_complaint = Complaint(
            complaint_id=complaint_id,
            user_id=current_user["user_id"],
            title=report.title,
            description=report.description,
            latitude=report.latitude,
            longitude=report.longitude,
            waste_type=report.waste_type,
            photo_url=report.photo_url,
            status="open",
        )

        session.add(new_complaint)
        session.commit()
        session.refresh(new_complaint)

        return {
            "message": "Report submitted successfully",
            "complaint_id": new_complaint.complaint_id,
            "status": new_complaint.status,
            "user_id": new_complaint.user_id,
        }


# =========================
# GET MY REPORTS
# =========================

@app.get("/api/my-reports")
def get_my_reports(
    current_user=Depends(get_current_user),
):
    with Session(engine) as session:
        complaints = (
            session.query(Complaint)
            .filter(Complaint.user_id == current_user["user_id"])
            .order_by(Complaint.id.desc())
            .all()
        )

        return {
            "user_id": current_user["user_id"],
            "total_reports": len(complaints),
            "reports": [
                {
                    "complaint_id": c.complaint_id,
                    "title": c.title,
                    "description": c.description,
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "waste_type": c.waste_type,
                    "photo_url": c.photo_url,
                    "status": c.status,
                }
                for c in complaints
            ],
        }


# =========================
# CHECK COMPLAINT STATUS
# =========================

@app.get("/api/complaints/{complaint_id}")
def get_complaint_status(
    complaint_id: str,
    current_user=Depends(get_current_user),
):
    with Session(engine) as session:
        complaint = (
            session.query(Complaint)
            .filter(
                Complaint.complaint_id == complaint_id,
                Complaint.user_id == current_user["user_id"],
            )
            .first()
        )

        if not complaint:
            raise HTTPException(
                status_code=404,
                detail="Complaint not found",
            )

        return {
            "complaint_id": complaint.complaint_id,
            "title": complaint.title,
            "description": complaint.description,
            "status": complaint.status,
            "waste_type": complaint.waste_type,
            "latitude": complaint.latitude,
            "longitude": complaint.longitude,
            "photo_url": complaint.photo_url,
        }


# =========================
# OFFICER: UPDATE COMPLAINT STATUS
# =========================

@app.patch("/api/complaints/{complaint_id}/status")
def update_complaint_status(
    complaint_id: str,
    update: StatusUpdate,
    current_user=Depends(require_officer),
):
    allowed_statuses = ["open", "assigned", "resolved"]

    if update.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Status must be open, assigned, or resolved",
        )

    with Session(engine) as session:
        complaint = (
            session.query(Complaint)
            .filter(Complaint.complaint_id == complaint_id)
            .first()
        )

        if not complaint:
            raise HTTPException(
                status_code=404,
                detail="Complaint not found",
            )

        old_status = complaint.status
        complaint.status = update.status

        session.commit()
        session.refresh(complaint)

        return {
            "message": "Complaint status updated successfully",
            "complaint_id": complaint.complaint_id,
            "previous_status": old_status,
            "new_status": complaint.status,
            "updated_by": current_user["user_id"],
        }


# =========================
# CURRENT USER
# =========================

@app.get("/api/me")
def get_me(
    current_user=Depends(get_current_user),
):
    return {
        "message": "Authenticated user",
        "user_id": current_user["user_id"],
        "email": current_user.get("email"),
        "role": current_user.get("role"),
    }


# =========================
# OFFICER DASHBOARD
# =========================

@app.get("/api/incidents")
def get_all_complaints(
    current_user=Depends(require_officer),
):
    with Session(engine) as session:
        complaints = (
            session.query(Complaint)
            .order_by(Complaint.id.desc())
            .all()
        )

        return {
            "total_complaints": len(complaints),
            "complaints": [
                {
                    "complaint_id": c.complaint_id,
                    "user_id": c.user_id,
                    "title": c.title,
                    "description": c.description,
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "waste_type": c.waste_type,
                    "photo_url": c.photo_url,
                    "status": c.status,
                }
                for c in complaints
            ],
        }


# =========================
# AI WASTE IMAGE CLASSIFICATION
# =========================

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WEBP image",
        )

    image_data = await file.read()

    if not image_data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty",
        )

    if len(image_data) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be smaller than 5 MB",
        )

    try:
        image = Image.open(BytesIO(image_data))
        image.verify()

        image = Image.open(BytesIO(image_data)).convert("RGB")

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image",
        )

    try:
        predictions = waste_classifier(image)
        best = predictions[0]

        waste_type = best["label"].lower()
        confidence = round(float(best["score"]), 4)

        actions = {
            "cardboard": "Send cardboard for recycling.",
            "glass": "Separate glass for safe recycling.",
            "metal": "Collect metal separately for recycling.",
            "paper": "Keep paper dry and send it for recycling.",
            "plastic": "Separate plastic for appropriate recycling.",
            "trash": "Review this waste manually for proper disposal.",
        }

        return {
            "message": "Image analyzed successfully",
            "filename": file.filename,
            "analysis_status": "ai_prediction",
            "waste_type": waste_type,
            "confidence": confidence,
            "suggested_action": actions.get(
                waste_type,
                "Review the waste manually.",
            ),
            "note": (
                "This is an AI classification prediction, "
                "not a guaranteed result or roadside waste detection."
            ),
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="AI image analysis failed. Please try another image.",
        )
