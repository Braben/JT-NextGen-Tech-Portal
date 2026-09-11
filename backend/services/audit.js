/**
 * Audit Log helper — records admin actions (create/update/delete) for
 * accountability and security investigations. Used by admin-affecting
 * routes. Automatically attaches the requesting admin's identity.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

/**
 * Write an entry to the staff audit log.
 * @param {Object} actor — { id, name, role } of the user performing the action
 * @param {string} action — short action id, e.g. create | update | payment.record
 * @param {string} entity_type — e.g. user, program, blog, certificate, enrollment
 * @param {string} [entity_id]
 * @param {string} [details] — short human-readable description
 */
async function audit(actor, action, entity_type, entity_id, details) {
  try {
    const id = uuidv4();
    try {
      await db.prepare(
        'INSERT INTO admin_audit_log (id, admin_id, admin_name, actor_role, action, entity_type, entity_id, details) VALUES (?,?,?,?,?,?,?,?)'
      ).run(id, actor.id, actor.name || '', actor.role || '', action, entity_type, entity_id || null, details || '');
    } catch (e) {
      // Older databases may not have actor_role until migrations run.
      await db.prepare(
        'INSERT INTO admin_audit_log (id, admin_id, admin_name, action, entity_type, entity_id, details) VALUES (?,?,?,?,?,?,?)'
      ).run(id, actor.id, actor.name || '', action, entity_type, entity_id || null, details || '');
    }
    await db.saveDb();
  } catch (e) {
    // Audit logging must never break the primary operation.
    console.error('[audit] failed to write log:', e.message);
  }
}

module.exports = audit;
