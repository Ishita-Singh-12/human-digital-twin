import { Client, TablesDB, ID, Query, Permission, Role } from 'node-appwrite';
import { METRICS, validateReading, latest, aggregate, range } from './analytics.js';

/** Authenticate by a validated JWT, not a client-supplied user-id header.
 * JWT SDK requests enforce document permissions for every database operation. */
export default async ({ req, res, error }) => {
  if (req.path === '/ping') return res.text('Pong');
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const databaseId = process.env.HDT_DATABASE_ID;
  const tableId = process.env.HDT_TABLE_ID;
  if (![endpoint,project,databaseId,tableId].every(Boolean)) return res.json({error:'Persistent store is not configured'},503);
  const jwt = req.headers['x-appwrite-user-jwt'] || req.headers['x-hdt-jwt'];
  if (!jwt) return res.json({error:'Sign in with Appwrite to access personal readings'},401);
  const client = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt);
  // Account.get validates the JWT and resolves its actual owner.
  const { Account } = await import('node-appwrite');
  let user;
  try { user = await new Account(client).get(); }
  catch { return res.json({error:'Invalid or expired Appwrite session'},401); }
  const db = new TablesDB(client);
  const scope = [Query.equal('ownerId',user.$id)];
  const list = async queries => db.listRows({databaseId,tableId,queries:[...scope,...queries]});
  try {
    const metric = req.path.slice(1);
    if (req.method === 'POST' && METRICS.includes(metric)) {
      let reading;
      try { reading = validateReading(metric,req.bodyJson ?? req.body); }
      catch (e) { return res.json({error:e.message},400); }
      const doc = await db.createRow({databaseId,tableId,rowId:ID.unique(),data:{...reading,ownerId:user.$id},
        permissions:[Permission.read(Role.user(user.$id)),Permission.update(Role.user(user.$id)),Permission.delete(Role.user(user.$id))]});
      return res.json({id:doc.$id,...reading},201);
    }
    if (req.method === 'GET' && req.path === '/get-health-data') {
      const rows = (await Promise.all(METRICS.map(metric=>list([Query.equal('metric',metric),Query.orderDesc('observedAt'),Query.limit(1)])))).flatMap(r=>r.rows);
      return res.json({...latest(rows),storage:'Appwrite database',fetchedAt:new Date().toISOString()});
    }
    if (req.method === 'GET' && req.path === '/analytics') {
      let selection;
      try { selection = range(req.query); } catch(e) { return res.json({error:e.message},400); }
      const rows=[]; let cursor;
      do {
        const page = await list([Query.greaterThanEqual('observedAt',new Date(selection.from).toISOString()),Query.lessThan('observedAt',new Date(selection.to).toISOString()),Query.orderAsc('observedAt'),Query.limit(100),...(cursor?[Query.cursorAfter(cursor)]:[])]);
        rows.push(...page.rows);
        if (rows.length > 20000) return res.json({error:'Too many readings for this range; choose a shorter period'},422);
        cursor = page.rows.length === 100 ? page.rows.at(-1).$id : null;
      } while(cursor);
      return res.json(aggregate(rows,selection));
    }
    return res.json({error:'Not found'},404);
  } catch(e) {
    error(`Persistence operation failed (${e.code ?? 'unknown'})`);
    return res.json({error:'Persistent health-data operation failed'},503);
  }
};
