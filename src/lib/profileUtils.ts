import type { BirthInput, Profile } from '../types';
import { MAX_PROFILES } from '../constants';
import { uid } from './utils';
import { buildChart } from './saju';

export function createProfile(birth: BirthInput): Profile {
  const now = Date.now();
  return {
    id: uid(),
    birth,
    marriage: { status: 'single', date: null, partnerProfileId: null, partnerManual: null },
    createdAt: now,
    updatedAt: now,
  };
}

/** 프로필 카드에 보여 줄 짧은 생년월일 요약 */
export function calcSolarSummary(birth: BirthInput): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = birth.calendar === 'lunar' ? `음 ${birth.leapMonth ? '윤' : ''}` : '';
  const time = birth.timeKnown ? ` ${pad(birth.hour)}:${pad(birth.minute)}` : ' 시간 모름';
  return `${label}${birth.year}.${pad(birth.month)}.${pad(birth.day)}${time}`;
}

export function capProfiles(profiles: Profile[]): Profile[] {
  return profiles.slice(0, MAX_PROFILES);
}

export function partnerBirthOf(profile: Profile, profiles: Profile[]): { name: string; birth: BirthInput } | null {
  if (profile.marriage.partnerManual) {
    return { name: profile.marriage.partnerManual.name, birth: profile.marriage.partnerManual.birth };
  }
  if (profile.marriage.partnerProfileId) {
    const linked = profiles.find((item) => item.id === profile.marriage.partnerProfileId);
    if (linked) return { name: linked.birth.name, birth: linked.birth };
  }
  return null;
}

export function partnerChartOf(profile: Profile, profiles: Profile[]) {
  const partner = partnerBirthOf(profile, profiles);
  if (!partner) return null;
  try {
    return { name: partner.name, chart: buildChart(partner.birth) };
  } catch {
    return null;
  }
}
