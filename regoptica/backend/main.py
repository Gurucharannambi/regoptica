from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import fitz  # PyMuPDF
import os
import json

app = FastAPI(title="RegOptica API")

# Allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Claude client
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


class AskRequest(BaseModel):
    question: str
    context: str = ""


@app.get("/")
def root():
    return {"status": "RegOptica API is running"}


@app.post("/extract")
async def extract_obligations(file: UploadFile = File(...)):
    """
    Upload a SEBI circular PDF.
    Returns extracted compliance obligations as JSON.
    """
    try:
        # Read PDF bytes
        pdf_bytes = await file.read()

        # Extract text using PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text()
        doc.close()

        # Limit text to 5000 chars to stay within token limits
        trimmed_text = full_text[:5000]

        # Call Claude to extract obligations
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system="""You are a SEBI regulatory compliance expert.
Extract compliance obligations from SEBI regulatory documents.
Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.
Each object must have these exact keys:
- code: string like SC/KYC/001
- obligation: string describing what must be done
- department: one of [KYC & Onboarding, Risk & Reporting, Investor Relations, Finance & Accounts, Operations]
- deadline: date string in YYYY-MM-DD format (30-60 days from today)
- frequency: one of [Daily, Weekly, Monthly, Quarterly, Per new client, Per grievance, One-time]
- evidence: string describing what proof/document is needed
- priority: one of [Critical, High, Medium, Low]
Extract 4-5 obligations. If document is unclear, generate realistic SEBI stockbroker obligations.""",
            messages=[
                {
                    "role": "user",
                    "content": f"Extract compliance obligations from this SEBI document:\n\nFilename: {file.filename}\n\nContent:\n{trimmed_text}"
                }
            ]
        )

        raw = response.content[0].text.strip()
        # Clean any accidental markdown
        clean = raw.replace("```json", "").replace("```", "").strip()
        obligations = json.loads(clean)

        return {"success": True, "obligations": obligations, "filename": file.filename}

    except json.JSONDecodeError:
        return {"success": False, "error": "Could not parse AI response as JSON", "obligations": []}
    except Exception as e:
        return {"success": False, "error": str(e), "obligations": []}


@app.post("/ask")
async def ask_assistant(data: AskRequest):
    """
    Ask the AI assistant a compliance question.
    Accepts question + optional context (list of obligations).
    """
    try:
        system_prompt = """You are RegOptica's AI compliance assistant for SEBI-registered stockbrokers.
You help compliance officers understand their SEBI obligations, deadlines, evidence requirements, and regulatory actions.
Be concise, specific, and practical. Use bullet points when listing items.
Always cite which SEBI circular or regulation you are referring to when possible."""

        if data.context:
            system_prompt += f"\n\nCurrent obligations in the system:\n{data.context}"

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": data.question}
            ]
        )

        return {"success": True, "answer": response.content[0].text}

    except Exception as e:
        return {"success": False, "answer": f"Error: {str(e)}"}
