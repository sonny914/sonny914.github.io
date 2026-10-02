import { buildEmptyHousehold } from './seed';
import { EMPTY_DEMO_STATE, applyDemoState } from './demoState';
import type { DbClient, DbResult } from './db';
import { LoadError, SaveError, saveErrorMessage } from './errors';
import type { HouseholdRepository } from './repository';
import {
  type AwayRow,
  type ContactRow,
  type MailRow,
  type UpdateRow,
  type WorkRow,
  awayFromRow,
  awayToRow,
  contactFromRow,
  mailFromRow,
  updateFromRow,
  updateToRpcArgs,
  workFromRow,
  workToRow,
} from './rows';
import type { MemberId } from './types';

const NOT_YET = 'That isn’t available in shared mode yet.';

/** Reads a query result or throws a LoadError. */
async function rows<T>(q: PromiseLike<DbResult<unknown>>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new LoadError();
  return (data ?? []) as T[];
}

/** Throws a SaveError with a plain-language message unless the write succeeded. */
function ok<T>(r: DbResult<T>): DbResult<T> {
  if (r.error) throw new SaveError(saveErrorMessage(r.error));
  return r;
}

/** A write that must change at least one row (RLS hides rows you may not touch, without an error). */
function changed(r: DbResult<unknown>, whatFailed: string): void {
  ok(r);
  if (!Array.isArray(r.data) || r.data.length === 0) throw new SaveError(whatFailed);
}

/**
 * The household's shared data in Supabase. Every call runs as the signed-in user, so the database's
 * row-level security decides what is allowed; nothing here can grant more than the policies do.
 * Attribution (created_by / updated_by) is set by the database from the account, never sent from here.
 */
export function createSupabaseRepository(db: DbClient): HouseholdRepository {
  return {
    mode: 'shared',

    async load(now) {
      const [work, away, updates, links, contacts, setup, mail] = await Promise.all([
        rows<WorkRow>(db.from('work_entries').select('id, member_id, start_date, start_time, end_date, end_time, repeat_weekdays, repeat_until, created_by, created_at, updated_by, updated_at').order('start_date')),
        rows<AwayRow>(db.from('unavailable_periods').select('id, member_id, start_at, end_at, all_day, note, created_by, created_at, updated_by, updated_at').order('start_at')),
        rows<UpdateRow>(db.from('child_updates').select('id, type, title, note, at, created_by, created_at, updated_by, updated_at').order('updated_at', { ascending: false })),
        rows<{ update_id: string; child_id: string }>(db.from('child_update_children').select('update_id, child_id')),
        rows<ContactRow>(db.from('trusted_contacts').select('id, name, role, relationship, phone, email, notes, updated_by, updated_at').order('name')),
        rows<{ member_id: string; status: 'done' | 'skipped' }>(db.from('setup_status').select('member_id, status')),
        rows<MailRow>(db.from('mail_checks').select('checked_by, checked_at').order('checked_at', { ascending: false }).limit(1)),
      ]);

      const childrenOf = new Map<string, string[]>();
      for (const l of links) childrenOf.set(l.update_id, [...(childrenOf.get(l.update_id) ?? []), l.child_id].sort());

      const snapshot = applyDemoState(
        buildEmptyHousehold(),
        {
          ...EMPTY_DEMO_STATE,
          workEntries: work.map(workFromRow),
          unavailable: away.map(awayFromRow),
          childUpdates: updates.map((u) => updateFromRow(u, childrenOf.get(u.id) ?? [])),
          setup: Object.fromEntries(setup.map((s) => [s.member_id, s.status])),
          mail: mail[0] ? mailFromRow(mail[0]) : undefined,
        },
        now,
      );
      return { ...snapshot, trustedContacts: contacts.map(contactFromRow) };
    },

    async saveWorkEntry(e) {
      ok(await db.from('work_entries').upsert(workToRow(e), { onConflict: 'id' }));
    },
    async deleteWorkEntry(id) {
      changed(await db.from('work_entries').delete().eq('id', id).select('id'), 'That shift isn’t yours to delete, or it was already removed.');
    },
    async saveUnavailable(u) {
      ok(await db.from('unavailable_periods').upsert(awayToRow(u), { onConflict: 'id' }));
    },
    async deleteUnavailable(id) {
      changed(await db.from('unavailable_periods').delete().eq('id', id).select('id'), 'That entry isn’t yours to delete, or it was already removed.');
    },

    async saveChildUpdate(u) {
      ok(await db.rpc('save_child_update', updateToRpcArgs(u)));
    },
    async deleteChildUpdate(id) {
      changed(await db.from('child_updates').delete().eq('id', id).select('id'), 'That update was already removed.');
    },

    async saveContact(id, patch) {
      changed(
        await db.from('trusted_contacts').update({ phone: patch.phone ?? null, email: patch.email ?? null, notes: patch.notes ?? null }).eq('id', id).select('id'),
        'Those details could not be saved.',
      );
    },

    async completeSetup(memberId: MemberId, status) {
      ok(await db.from('setup_status').upsert({ member_id: memberId, status }, { onConflict: 'member_id' }));
    },

    async markMailChecked(by) {
      // The database overwrites checked_by with the signed-in account; `by` only satisfies NOT NULL.
      ok(await db.from('mail_checks').insert({ checked_by: by }));
    },
    async resetMailCheck() {
      const r = ok(await db.rpc('undo_mail_check'));
      if (r.data !== true) throw new SaveError('Only the person who checked the mail can undo it.');
    },

    // Coverage needs, confirmations and chores are not shared records yet.
    async claimCoverage() { throw new SaveError(NOT_YET); },
    async confirmEvent() { throw new SaveError(NOT_YET); },
    async completeTask() { throw new SaveError(NOT_YET); },
    async releaseCoverage() { throw new SaveError(NOT_YET); },
    async unconfirmEvent() { throw new SaveError(NOT_YET); },
    async reopenTask() { throw new SaveError(NOT_YET); },
  };
}
