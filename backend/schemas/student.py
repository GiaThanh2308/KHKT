from pydantic import BaseModel

class StudentCreate(BaseModel):
    student_code: str
    full_name: str
    class_name: str
    face_label: str
    phone: str = ""
    parent_phone: str = ""
class ViolationCreate(BaseModel):
    student_id: int

    violation_type: str

    note: str = ""

    image_path: str = ""