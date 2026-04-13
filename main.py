from fastapi import FastAPI, Request, Depends, Form, status
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date
import json

from database import get_db, engine
import models
from models import User, MedicalCard, Appointment, Anamnesis
from auth import (
    create_access_token, verify_password, get_password_hash,
    get_current_user_from_request, decode_token
)
from ai_agent import suggest_symptoms, get_area_label, get_all_areas

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Medical Anamnesis App")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def get_user_ctx(request: Request, db: Session):
    token = request.cookies.get("access_token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    return user


# ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if user:
        return RedirectResponse(url=f"/{user.role}/dashboard", status_code=302)
    return RedirectResponse(url="/login", status_code=302)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if user:
        return RedirectResponse(url=f"/{user.role}/dashboard", status_code=302)
    return templates.TemplateResponse(request, "login.html", {"error": None})


@app.post("/login")
async def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        return templates.TemplateResponse(
            request, "login.html", {"error": "Неверный email или пароль"}
        )
    token = create_access_token({"user_id": user.id, "role": user.role, "email": user.email})
    response = RedirectResponse(url=f"/{user.role}/dashboard", status_code=302)
    response.set_cookie("access_token", token, httponly=True, max_age=86400)
    return response


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse(request, "register.html", {"error": None})


@app.post("/register")
async def register(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return templates.TemplateResponse(
            request, "register.html", {"error": "Email уже зарегистрирован"}
        )
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role="patient",
        full_name=full_name
    )
    db.add(user)
    db.flush()
    card = MedicalCard(user_id=user.id)
    db.add(card)
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id, "role": user.role, "email": user.email})
    response = RedirectResponse(url="/patient/dashboard", status_code=302)
    response.set_cookie("access_token", token, httponly=True, max_age=86400)
    return response


@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie("access_token")
    return response


# ─── PATIENT ROUTES ───────────────────────────────────────────────────────────

@app.get("/patient/dashboard", response_class=HTMLResponse)
async def patient_dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user or user.role != "patient":
        return RedirectResponse(url="/login", status_code=302)
    card = db.query(MedicalCard).filter(MedicalCard.user_id == user.id).first()
    appointments = []
    if card:
        appointments = (
            db.query(Appointment)
            .filter(Appointment.medical_card_id == card.id)
            .order_by(Appointment.appointment_datetime.desc())
            .all()
        )
    return templates.TemplateResponse(request, "patient_dashboard.html", {
        "user": user,
        "card": card,
        "appointments": appointments
    })


@app.get("/patient/anamnesis/{appointment_id}", response_class=HTMLResponse)
async def anamnesis_page(request: Request, appointment_id: int, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user or user.role != "patient":
        return RedirectResponse(url="/login", status_code=302)
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        return RedirectResponse(url="/patient/dashboard", status_code=302)
    card = db.query(MedicalCard).filter(MedicalCard.user_id == user.id).first()
    if not card or appointment.medical_card_id != card.id:
        return RedirectResponse(url="/patient/dashboard", status_code=302)
    existing = db.query(Anamnesis).filter(Anamnesis.appointment_id == appointment_id).first()
    return templates.TemplateResponse(request, "anamnesis.html", {
        "user": user,
        "appointment": appointment,
        "existing": existing,
        "areas": get_all_areas()
    })


@app.post("/api/anamnesis/symptoms")
async def get_symptoms(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    body = await request.json()
    pain_area = body.get("pain_area", "")
    symptoms = suggest_symptoms(pain_area)
    label = get_area_label(pain_area)
    return JSONResponse({"symptoms": symptoms, "label": label})


@app.post("/api/anamnesis/save")
async def save_anamnesis(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user or user.role != "patient":
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    body = await request.json()
    appointment_id = body.get("appointment_id")
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        return JSONResponse({"error": "Appointment not found"}, status_code=404)
    card = db.query(MedicalCard).filter(MedicalCard.user_id == user.id).first()
    if not card or appointment.medical_card_id != card.id:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    existing = db.query(Anamnesis).filter(Anamnesis.appointment_id == appointment_id).first()
    pain_area = body.get("pain_area", "")
    if existing:
        existing.pain_area = pain_area
        existing.pain_area_label = get_area_label(pain_area)
        existing.pain_level = body.get("pain_level", 1)
        existing.symptoms = body.get("symptoms", [])
        existing.additional_info = body.get("additional_info", "")
    else:
        anamnesis = Anamnesis(
            medical_card_id=card.id,
            appointment_id=appointment_id,
            pain_area=pain_area,
            pain_area_label=get_area_label(pain_area),
            pain_level=body.get("pain_level", 1),
            symptoms=body.get("symptoms", []),
            additional_info=body.get("additional_info", "")
        )
        db.add(anamnesis)
    appointment.status = "filled"
    db.commit()
    return JSONResponse({"success": True})


# ─── DOCTOR ROUTES ────────────────────────────────────────────────────────────

@app.get("/doctor/dashboard", response_class=HTMLResponse)
async def doctor_dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user or user.role != "doctor":
        return RedirectResponse(url="/login", status_code=302)
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == user.id,
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime <= today_end
        )
        .order_by(Appointment.appointment_datetime)
        .all()
    )
    return templates.TemplateResponse(request, "doctor_dashboard.html", {
        "user": user,
        "appointments": appointments,
        "today": date.today()
    })


@app.get("/doctor/patient/{appointment_id}", response_class=HTMLResponse)
async def doctor_patient_detail(request: Request, appointment_id: int, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user or user.role != "doctor":
        return RedirectResponse(url="/login", status_code=302)
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment or appointment.doctor_id != user.id:
        return RedirectResponse(url="/doctor/dashboard", status_code=302)
    anamnesis = db.query(Anamnesis).filter(Anamnesis.appointment_id == appointment_id).first()
    card = db.query(MedicalCard).filter(MedicalCard.id == appointment.medical_card_id).first()
    patient = db.query(User).filter(User.id == card.user_id).first() if card else None
    appointment.status = "completed" if anamnesis else appointment.status
    db.commit()
    return templates.TemplateResponse(request, "patient_detail.html", {
        "user": user,
        "appointment": appointment,
        "anamnesis": anamnesis,
        "patient": patient,
        "card": card
    })


# ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_user_ctx(request, db)
    if not user or user.role != "admin":
        return RedirectResponse(url="/login", status_code=302)
    patients = db.query(User).filter(User.role == "patient").all()
    doctors = db.query(User).filter(User.role == "doctor").all()
    appointments = db.query(Appointment).order_by(Appointment.appointment_datetime.desc()).limit(20).all()
    return templates.TemplateResponse(request, "admin_dashboard.html", {
        "user": user,
        "patients": patients,
        "doctors": doctors,
        "appointments": appointments
    })


@app.post("/admin/create-user")
async def admin_create_user(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db)
):
    user = get_user_ctx(request, db)
    if not user or user.role != "admin":
        return RedirectResponse(url="/login", status_code=302)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        patients = db.query(User).filter(User.role == "patient").all()
        doctors = db.query(User).filter(User.role == "doctor").all()
        appointments = db.query(Appointment).order_by(Appointment.appointment_datetime.desc()).limit(20).all()
        return templates.TemplateResponse(request, "admin_dashboard.html", {
            "user": user,
            "patients": patients,
            "doctors": doctors,
            "appointments": appointments,
            "error": "Email уже существует"
        })
    new_user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=role,
        full_name=full_name
    )
    db.add(new_user)
    db.flush()
    if role == "patient":
        card = MedicalCard(user_id=new_user.id)
        db.add(card)
    db.commit()
    return RedirectResponse(url="/admin/dashboard", status_code=302)


@app.post("/admin/create-appointment")
async def admin_create_appointment(
    request: Request,
    patient_id: int = Form(...),
    doctor_id: int = Form(...),
    appointment_date: str = Form(...),
    appointment_time: str = Form(...),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    user = get_user_ctx(request, db)
    if not user or user.role != "admin":
        return RedirectResponse(url="/login", status_code=302)
    patient = db.query(User).filter(User.id == patient_id).first()
    card = db.query(MedicalCard).filter(MedicalCard.user_id == patient.id).first() if patient else None
    if not card:
        return RedirectResponse(url="/admin/dashboard", status_code=302)
    dt_str = f"{appointment_date} {appointment_time}"
    appointment_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    appt = Appointment(
        medical_card_id=card.id,
        doctor_id=doctor_id,
        appointment_datetime=appointment_dt,
        notes=notes,
        status="pending"
    )
    db.add(appt)
    db.commit()
    return RedirectResponse(url="/admin/dashboard", status_code=302)


@app.post("/admin/seed")
async def seed_admin(request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == "admin@clinic.ru").first()
    if existing:
        return JSONResponse({"message": "Already seeded"})
    admin = User(
        email="admin@clinic.ru",
        hashed_password=get_password_hash("admin123"),
        role="admin",
        full_name="Администратор"
    )
    db.add(admin)
    doctor = User(
        email="doctor@clinic.ru",
        hashed_password=get_password_hash("doctor123"),
        role="doctor",
        full_name="Иванов Иван Иванович"
    )
    db.add(doctor)
    db.commit()
    return JSONResponse({"message": "Seeded: admin@clinic.ru / admin123, doctor@clinic.ru / doctor123"})
