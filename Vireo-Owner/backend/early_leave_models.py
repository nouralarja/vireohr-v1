from pydantic import BaseModel
from typing import Optional

class EarlyLeaveRequest(BaseModel):
    attendanceId: str
    reason: str
    requestedExit: str  # ISO time string

class EarlyLeaveResponse(BaseModel):
    status: str  # APPROVED or DENIED
