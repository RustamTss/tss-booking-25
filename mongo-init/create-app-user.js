// This script runs automatically on first MongoDB container start.
// It creates an application database and user with SCRAM-SHA-256.
// It uses env vars injected by docker-compose.prod.yml (MONGO_INITDB_* for root).
// Adjust db/user/password by setting MONGO_APP_USER/MONGO_APP_PASSWORD/MONGO_APP_DB in the environment if needed.

const appDb = process.env.MONGO_APP_DB || 'shop'
const appUser = process.env.MONGO_APP_USER || 'shop_user'
const appPass = process.env.MONGO_APP_PASSWORD || 'changeMe'

db = db.getSiblingDB(appDb)
db.createUser({
	user: appUser,
	pwd: appPass,
	roles: [{ role: 'readWrite', db: appDb }],
})

print(`Created MongoDB app user '${appUser}' on db '${appDb}'.`)
