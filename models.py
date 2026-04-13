from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # patient, doctor, admin
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    medical_card = relationship("MedicalCard", back_populates="user", uselist=False)
    doctor_appointments = relationship(
        "Appointment", back_populates="doctor", foreign_keys="Appointment.doctor_id"
    )


class MedicalCard(Base):
    __tablename__ = "medical_cards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    date_of_birth = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="medical_card")
    appointments = relationship("Appointment", back_populates="medical_card")
    anamneses = relationship("Anamnesis", back_populates="medical_card")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    medical_card_id = Column(Integer, ForeignKey("medical_cards.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    appointment_datetime = Column(DateTime)
    status = Column(String, default="pending")  # pending, filled, completed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    medical_card = relationship("MedicalCard", back_populates="appointments")
    doctor = relationship("User", back_populates="doctor_appointments", foreign_keys=[doctor_id])
    anamnesis = relationship("Anamnesis", back_populates="appointment", uselist=False)


class Anamnesis(Base):
    __tablename__ = "anamnesis"

    id = Column(Integer, primary_key=True, index=True)
    medical_card_id = Column(Integer, ForeignKey("medical_cards.id"))
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    pain_area = Column(String)
    pain_area_label = Column(String)
    pain_level = Column(Integer)
    symptoms = Column(JSON)
    additional_info = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    medical_card = relationship("MedicalCard", back_populates="anamneses")
    appointment = relationship("Appointment", back_populates="anamnesis")
