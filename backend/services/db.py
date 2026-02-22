"""
MongoDB persistence for Vitality. Uses Motor (async driver).
Set MONGODB_URI in .env (e.g. mongodb+srv://user:pass@cluster.mongodb.net/vitality?retryWrites=true&w=majority).
"""
import os
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient


def _to_json_safe(obj: Any) -> Any:
    """Convert MongoDB docs to JSON-serializable form (ObjectId -> str)."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_safe(v) for v in obj]
    return obj

_env_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_raw_uri = os.getenv("MONGODB_URI", "")
# Treat placeholder / invalid host as "no MongoDB" so the app runs without 500s
MONGODB_URI = "" if not _raw_uri or "YOUR_CLUSTER" in _raw_uri.lower() else _raw_uri
DB_NAME = "vitality"

_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI is not set in environment")
        _client = AsyncIOMotorClient(MONGODB_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


async def close_client():
    global _client
    if _client is not None:
        _client.close()
        _client = None


# --- Cycle periods ---
COLL_PERIODS = "cycle_periods"


async def db_get_cycle_periods() -> List[Dict[str, Any]]:
    if not MONGODB_URI:
        return []
    coll = get_db()[COLL_PERIODS]
    cursor = coll.find({}).sort("startDate", 1)
    raw = await cursor.to_list(length=1000)
    return [_to_json_safe(d) for d in raw]


async def db_upsert_cycle_period(start_date: str, end_date: Optional[str], flow: Optional[str], notes: Optional[str]) -> None:
    if not MONGODB_URI:
        return
    coll = get_db()[COLL_PERIODS]
    await coll.delete_many({"startDate": start_date})
    await coll.insert_one({
        "startDate": start_date,
        "endDate": end_date,
        "flow": flow,
        "notes": notes,
    })


# --- Symptoms ---
COLL_SYMPTOMS = "symptoms"


async def db_get_symptoms(cutoff_iso: str) -> List[Dict[str, Any]]:
    if not MONGODB_URI:
        return []
    coll = get_db()[COLL_SYMPTOMS]
    cursor = coll.find({"timestamp": {"$gte": cutoff_iso}}).sort("timestamp", -1)
    raw = await cursor.to_list(length=5000)
    return [_to_json_safe(d) for d in raw]


async def db_add_symptom(rec: Dict[str, Any]) -> None:
    if not MONGODB_URI:
        return
    coll = get_db()[COLL_SYMPTOMS]
    await coll.insert_one(rec)


async def db_add_symptoms_bulk(recs: List[Dict[str, Any]]) -> None:
    if not MONGODB_URI or not recs:
        return
    coll = get_db()[COLL_SYMPTOMS]
    await coll.insert_many(recs)


# --- Appointments ---
COLL_APPOINTMENTS = "appointments"


async def db_get_appointments(from_date: Optional[str], to_date: Optional[str]) -> List[Dict[str, Any]]:
    if not MONGODB_URI:
        return []
    coll = get_db()[COLL_APPOINTMENTS]
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["date"] = {}
        if from_date:
            q["date"]["$gte"] = from_date
        if to_date:
            q["date"]["$lte"] = to_date
    cursor = coll.find(q).sort("date", 1).sort("time", 1)
    raw = await cursor.to_list(length=500)
    return [_to_json_safe(d) for d in raw]


async def db_add_appointment(rec: Dict[str, Any]) -> None:
    if not MONGODB_URI:
        return
    coll = get_db()[COLL_APPOINTMENTS]
    await coll.insert_one(rec)


# --- Settings (wearable profile) ---
COLL_SETTINGS = "settings"
SETTINGS_DOC_ID = "default"


async def db_get_wearable_profile() -> str:
    if not MONGODB_URI:
        return "follicular"
    coll = get_db()[COLL_SETTINGS]
    doc = await coll.find_one({"_id": SETTINGS_DOC_ID})
    if doc and isinstance(doc.get("wearable_profile"), str):
        return doc["wearable_profile"]
    return "follicular"


async def db_set_wearable_profile(profile: str) -> None:
    if not MONGODB_URI:
        return
    coll = get_db()[COLL_SETTINGS]
    await coll.update_one(
        {"_id": SETTINGS_DOC_ID},
        {"$set": {"wearable_profile": profile}},
        upsert=True,
    )


# --- Profiles (wearable/vitals definitions) ---
COLL_PROFILES = "profiles"


async def db_get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    if not MONGODB_URI:
        return None
    coll = get_db()[COLL_PROFILES]
    doc = await coll.find_one({"_id": profile_id})
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k != "_id"}


async def db_get_all_profiles() -> Dict[str, Dict[str, Any]]:
    """Return dict of profile_id -> { label, hr, hrv, ... } for drop-in use in wearable."""
    if not MONGODB_URI:
        return {}
    coll = get_db()[COLL_PROFILES]
    cursor = coll.find({})
    out: Dict[str, Dict[str, Any]] = {}
    async for doc in cursor:
        pid = doc.get("_id")
        if pid is not None:
            out[str(pid)] = {k: v for k, v in doc.items() if k != "_id"}
    return out


async def db_seed_profiles(profiles_dict: Dict[str, Dict[str, Any]]) -> None:
    if not MONGODB_URI or not profiles_dict:
        return
    coll = get_db()[COLL_PROFILES]
    n = await coll.count_documents({})
    if n > 0:
        return
    for pid, data in profiles_dict.items():
        doc = {"_id": pid, **data}
        await coll.insert_one(doc)


async def db_seed_initial(
    profiles_dict: Dict[str, Dict[str, Any]],
    *,
    sample_periods: Optional[List[Dict[str, Any]]] = None,
    sample_symptoms: Optional[List[Dict[str, Any]]] = None,
    sample_appointments: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """Idempotent seed: default settings, profiles, and optional sample data if collections empty."""
    if not MONGODB_URI:
        return
    db = get_db()

    # Default settings (upsert so always present)
    await db[COLL_SETTINGS].update_one(
        {"_id": SETTINGS_DOC_ID},
        {"$set": {"wearable_profile": "follicular"}},
        upsert=True,
    )

    # Profiles from wearable definitions
    await db_seed_profiles(profiles_dict)

    # Sample cycle periods (only if empty)
    if sample_periods:
        n = await db[COLL_PERIODS].count_documents({})
        if n == 0:
            for p in sample_periods:
                await db[COLL_PERIODS].insert_one(p)

    # Sample symptoms (only if empty)
    if sample_symptoms:
        n = await db[COLL_SYMPTOMS].count_documents({})
        if n == 0:
            await db[COLL_SYMPTOMS].insert_many(sample_symptoms)

    # Sample appointments (only if empty)
    if sample_appointments:
        n = await db[COLL_APPOINTMENTS].count_documents({})
        if n == 0:
            await db[COLL_APPOINTMENTS].insert_many(sample_appointments)
