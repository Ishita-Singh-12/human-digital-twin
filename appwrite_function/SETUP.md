# Persistent per-user readings

Deploy this folder as a Node Appwrite Function (entrypoint main.js, build npm ci).
Create a database and collection with document security enabled. Collection creation
permission: authenticated users only. No collection-wide read/update/delete permission.
Attributes: ownerId string(36) required, metric enum[bpm,steps,calories,sleep] required,
numericValue float optional, textValue string(120) optional, observedAt datetime required,
receivedAt datetime required. Index ownerId + metric + observedAt and ownerId + observedAt.
Set HDT_DATABASE_ID and HDT_COLLECTION_ID on the function. Configure authenticated-user
execution. Reads and writes use a verified user JWT and enforce row permissions, not an
admin API key or a caller-supplied owner ID. Browser and watch must sign in through Appwrite.

Dashboard server: GET_HEALTH_URL = this function's /get-health-data URL.
Browser public settings: NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID.
Register dashboard host and Android package as Appwrite platforms. Public configuration
is not a credential. No API key goes to the browser or watch.

GET /get-health-data returns latest independently timestamped metrics.
GET /analytics?days=1&bucket=hour returns stored history, 7/30 days use day buckets.
POST /bpm, /steps, /calories, /sleep accepts value and optional observedAt ISO timestamp.
Server receive time is recorded separately. Missing observedAt defaults to receive time.

Aggregations are sample-weighted averages, min, max, counts and first/last-bucket deltas.
No interpolation. Steps/calories are cumulative snapshots, not summed daily totals.
Sleep strings remain latest values and are not averaged. UTC buckets are explicit.
Range pagination is capped at 20,000 records and fails visibly rather than truncating.

A raw unauthenticated watch POST from the old sender is deliberately rejected. A real
watch login/session acquisition still needs device integration and physical-device testing.
This is not clinical analytics, alerts or a diagnosis. Do not backfill fake personal data.
