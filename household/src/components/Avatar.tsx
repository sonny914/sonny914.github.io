import type { HouseholdMember, MemberId } from '../data/types';

export function Avatar({ member, size = 28 }: { member: HouseholdMember; size?: number }) {
  return (
    <span
      className="avatar"
      data-color={member.color}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      aria-hidden="true"
    >
      {member.initial}
    </span>
  );
}

export function AvatarStack({ ids, members }: { ids: MemberId[]; members: HouseholdMember[] }) {
  const list = ids.map((id) => members.find((m) => m.id === id)).filter((m): m is HouseholdMember => !!m);
  return (
    <span className="avatar-stack">
      {list.map((m) => (
        <Avatar key={m.id} member={m} size={24} />
      ))}
    </span>
  );
}
