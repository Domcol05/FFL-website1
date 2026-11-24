import os
import json
import requests
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Literal, Optional
from google import genai
from google.genai import types
import firebase_admin
from firebase_admin import credentials, firestore

# Variabili d'ambiente caricate da GitHub Secrets
FB_PAGE_ID = os.environ["FB_PAGE_ID"]
FB_ACCESS_TOKEN = os.environ["FB_ACCESS_TOKEN"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
FIREBASE_SA_JSON = os.environ["FIREBASE_SERVICE_ACCOUNT"]
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")

IMG_OUTPUT_DIR = "assets/img/fb-sync"

# Inizializzazione Firebase Admin SDK
cred_dict = json.loads(FIREBASE_SA_JSON)
cred = credentials.Certificate(cred_dict)
firebase_admin.initialize_app(cred)
db = firestore.client()

# Inizializzazione client Gemini
ai_client = genai.Client(api_key=GEMINI_API_KEY)


class PostClassification(BaseModel):
    action: Literal["event", "notice", "ignore"] = Field(
        description="event se annuncia un appuntamento/degustazione/festa con data; notice se è un avviso/comunicazione utile ai soci; ignore se è un meme, augurio generico o post non pertinente."
    )
    title: str = Field(description="Titolo breve, chiaro e invitante in italiano.")
    category: Literal["Degustazione", "Incontro", "Festa"] = Field(
        default="Degustazione",
        description="Valido solo se action == event."
    )
    dateStart: Optional[str] = Field(
        default=None,
        description="Data e ora di inizio in formato ISO 8601 locale (YYYY-MM-DDTHH:MM), es. 2026-12-15T20:30. Obbligatorio se action == event."
    )
    location: str = Field(
        default="Monte di Procida (NA)",
        description="Luogo dell'evento a Monte di Procida o Campi Flegrei."
    )
    description: str = Field(
        description="Testo pulito, ben formattato e privo di hashtag superflui."
    )
    participationInfo: str = Field(
        default="",
        description="Eventuale quota o modalità d'ingresso (es. 'Ingresso libero', 'Contributo 15€')."
    )
    phone: str = Field(
        default="",
        description="Eventuale numero di telefono per info/prenotazioni presente nel post."
    )
    isUrgent: bool = Field(
        default=False,
        description="True solo se action == notice ed è un cambio orario, rinvio o annullamento urgente."
    )


def fetch_recent_facebook_posts(limit: int = 10) -> list[dict]:
    url = f"https://graph.facebook.com/v21.0/{FB_PAGE_ID}/posts"
    params = {
        "fields": "id,message,created_time,full_picture,permalink_url",
        "limit": limit,
        "access_token": FB_ACCESS_TOKEN,
    }
    resp = requests.get(url, params=params, timeout=20)
    resp.raise_for_status()
    return resp.json().get("data", [])


def is_already_synced(fb_post_id: str) -> bool:
    docs = (
        db.collection("fb_sync_log")
        .where("facebookPostId", "==", fb_post_id)
        .limit(1)
        .get()
    )
    return len(docs) > 0


def download_post_image(fb_post_id: str, image_url: str) -> str:
    if not image_url:
        return ""
    os.makedirs(IMG_OUTPUT_DIR, exist_ok=True)
    safe_id = fb_post_id.replace("_", "-")
    rel_path = f"{IMG_OUTPUT_DIR}/{safe_id}.jpg"
    try:
        img_resp = requests.get(image_url, timeout=20)
        img_resp.raise_for_status()
        with open(rel_path, "wb") as f:
            f.write(img_resp.content)
        return rel_path
    except Exception as exc:
        print(f"Impossibile scaricare immagine per {fb_post_id}: {exc}")
        return ""


def analyze_post_with_gemini(message: str, created_time: str) -> PostClassification:
    prompt = f"""
Sei l'assistente editoriale dell'associazione culturale ed enogastronomica "Flegrea Food Lovers" di Monte di Procida (NA).
Analizza questo post pubblicato sulla pagina Facebook ufficiale il {created_time} e trasformalo in dati strutturati per il sito web.

Regole:
- Se il post annuncia un evento futuro (degustazione, sagra, passeggiata gastronomica, incontro) con una data riconoscibile, imposta action="event" e ricava dateStart in formato YYYY-MM-DDTHH:MM (se manca l'orario usa 20:00; deduci l'anno corretto dalla data di pubblicazione {created_time}).
- Se il post è un comunicato importante (es. apertura tesseramento, rinvio evento per maltempo, cambio orario, avviso ai soci), imposta action="notice".
- Se il post è solo una foto ricordo passata, un augurio festivo o un contenuto generico senza informazioni operative, imposta action="ignore".
- Pulisci il testo da elenchi lunghi di hashtag (#...) mantenendo tutte le informazioni utili.

Testo del post Facebook:
\"\"\"{message}\"\"\"
"""
    response = ai_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PostClassification,
            temperature=0.1,
        ),
    )
    return PostClassification.model_validate_json(response.text)


def main():
    posts = fetch_recent_facebook_posts(limit=10)
    print(f"Trovati {len(posts)} post recenti su Facebook.")

    for post in posts:
        fb_id = post.get("id")
        message = (post.get("message") or "").strip()
        if not fb_id or not message:
            continue

        if is_already_synced(fb_id):
            print(f"[SKIP] Post {fb_id} già sincronizzato.")
            continue

        print(f"[ANALISI] Elaborazione post {fb_id}...")
        parsed = analyze_post_with_gemini(message, post.get("created_time", ""))

        if parsed.action == "event" and parsed.dateStart:
            local_cover = download_post_image(fb_id, post.get("full_picture", ""))
            maps_query = requests.utils.quote(parsed.location)
            event_doc = {
                "title": parsed.title,
                "category": parsed.category,
                "dateStart": parsed.dateStart,
                "location": parsed.location,
                "mapsUrl": f"https://www.google.com/maps/search/?api=1&query={maps_query}",
                "description": parsed.description,
                "coverUrl": local_cover,
                "phone": parsed.phone,
                "participationInfo": parsed.participationInfo,
                "parkings": [],
                "customParking": "",
                "gallery": [],
                "source": "facebook-ai",
                "facebookPostId": fb_id,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
            db.collection("events").add(event_doc)
            print(f"[OK] Creato evento su Firestore: {parsed.title}")

        elif parsed.action == "notice":
            notice_doc = {
                "title": parsed.title,
                "message": parsed.description,
                "isUrgent": parsed.isUrgent,
                "linkUrl": post.get("permalink_url", ""),
                "linkLabel": "Vedi post su Facebook",
                "source": "facebook-ai",
                "facebookPostId": fb_id,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
            db.collection("notices").add(notice_doc)
            print(f"[OK] Creato avviso su Firestore: {parsed.title}")
        else:
            print(f"[IGNORATO] Post {fb_id} classificato come '{parsed.action}'.")

        db.collection("fb_sync_log").add({
            "facebookPostId": fb_id,
            "action": parsed.action,
            "processedAt": datetime.now(timezone.utc).isoformat(),
        })


if __name__ == "__main__":
    main()