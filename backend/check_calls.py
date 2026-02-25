import os
from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv()

client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))

# Check the last 5 outbound calls
calls = client.calls.list(limit=5)
for c in calls:
    print(f"SID: {c.sid}")
    print(f"  To:        {c.to}")
    print(f"  From:      {c.from_formatted}")
    print(f"  Status:    {c.status}")
    print(f"  Direction: {c.direction}")
    print(f"  Duration:  {c.duration}s")
