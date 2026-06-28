from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz
import os
import json
import urllib.request
import urllib.parse

app = FastAPI(title="RegOptica API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


def call_gemini(prompt):
    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 1000, "temperature": 0.1}
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        return result["candidates"][0]["content"]["parts"][0]["text"]


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

        prompt = f"""You are a SEBI regulatory compliance expert.
Extract compliance obligations from this SEBI document.
Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.
Each object must have:
- code: string like SC/KYC/001
- obligation: what must be done
- department: one of [KYC & Onboarding, Risk & Reporting, Investor Relations, Finance & Accounts, Operations]
- deadline: YYYY-MM-DD format date in 2025
- frequency: one of [Daily, Weekly, Monthly, Quarterly, Per new client, Per grievance, One-time]
- evidence: what proof is needed
- priority: one of [Critical, High, Medium, Low]

Extract 4-5 obligations. Return ONLY the JSON array.

Document: {file.filename}
Content: {trimmed_text}"""

        raw = call_gemini(prompt)
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
        prompt = f"""You are RegOptica's AI compliance assistant for SEBI-registered stockbrokers.
Help compliance officers understand SEBI obligations, deadlines, and regulatory actions.
Be concise and practical.

Current obligations:
{data.context}

Question: {data.question}"""

        answer = call_gemini(prompt)
        return {"success": True, "answer": answer}

    except Exception as e:
        return {"success": False, "answer": f"Error: {str(e)}"}
