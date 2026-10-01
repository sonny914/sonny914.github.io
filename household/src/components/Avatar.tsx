import type { HouseholdMember, MemberId } from '../data/types';

export function Avatar({ member, size = 24 }: { member: HouseholdMember; size?: number }) {
  return (
    <span
      className="avatar"
      data-color={member.color}
      style={{ width: size, height: size, fontSize: size >= 28 ? 14 : 12 }}
      aria-hidden="true"
    >
      {member.initial}
    </span>
  );
}

/** Avatar plus name, so identity never rests on colour alone. */
export function Person({ member }: { member: HouseholdMember }) {
  return (
    <span className="person">
      <Avatar member={member} />
      {member.name}
    </span>
  );
}

export function lookup(ids: MemberId[], members: HouseholdMember[]): HouseholdMember[] {
  return ids.map((id) => members.find((m) => m.id === id)).filter((m): m is HouseholdMember => !!m);
}
