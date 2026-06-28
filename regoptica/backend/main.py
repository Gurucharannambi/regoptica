from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz  # PyMuPDF
import os
import json
import urllib.request

app = FastAPI(title="RegOptica API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama3-70b-8192"


def call_groq(system_prompt, user_message):
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 1000,
        "temperature": 0.1
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"]


class AskRequest(BaseModel):
    question: str
    context: str = ""


@app.get("/")
def root():
    return {"status": "RegOptica API is running"}


@app.post("/extract")
async def extract_obligations(file: UploadFile = File(...)):
    try:
        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text()
        doc.close()

        trimmed_text = full_text[:5000]

        system_prompt = """You are a SEBI regulatory compliance expert.
Extract compliance obligations from SEBI regulatory documents.
Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.
Each object must have these exact keys:
- code: string like SC/KYC/001
- obligation: string describing what must be done
- department: one of [KYC & Onboarding, Risk & Reporting, Investor Relations, Finance & Accounts, Operations]
- deadline: date string in YYYY-MM-DD format (use dates in 2025)
- frequency: one of [Daily, Weekly, Monthly, Quarterly, Per new client, Per grievance, One-time]
- evidence: string describing what proof is needed
- priority: one of [Critical, High, Medium, Low]
Extract 4-5 obligations. Return ONLY the JSON array, nothing else."""

        user_message = f"Extract compliance obligations from this SEBI document:\nFilename: {file.filename}\nContent:\n{trimmed_text}"

        raw = call_groq(system_prompt, user_message)
        clean = raw.replace("```json", "").replace("```", "").strip()
        obligations = json.loads(clean)

        return {"success": True, "obligations": obligations, "filename": file.filename}

    except json.JSONDecodeError:
        return {"success": False, "error": "Could not parse AI response", "obligations": []}
    except Exception as e:
        return {"success": False, "error": str(e), "obligations": []}


@app.post("/ask")
async def ask_assistant(data: AskRequest):
    try:
        system_prompt = """You are RegOptica's AI compliance assistant for SEBI-registered stockbrokers.
Help compliance officers understand SEBI obligations, deadlines, evidence requirements, and regulatory actions.
Be concise, specific, and practical."""

        if data.context:
            system_prompt += f"\n\nCurrent obligations:\n{data.context}"

        answer = call_groq(system_prompt, data.question)
        return {"success": True, "answer": answer}

    except Exception as e:
        return {"success": False, "answer": f"Error: {str(e)}"}
