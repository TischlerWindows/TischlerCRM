import { getSetting } from './preferences';

export interface OpportunitySummaryMatch {
  summary: any | null;
  matchType: 'linkedOpportunityId' | 'opportunityNumber' | 'opportunityName' | 'none';
  reason: string;
}

interface OpportunityLike {
  id?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function readOpportunityValue(opportunity: OpportunityLike, keys: string[]): string {
  for (const key of keys) {
    const direct = opportunity[key];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const fromData = opportunity.data?.[key];
    if (typeof fromData === 'string' && fromData.trim()) return fromData.trim();
  }
  return '';
}

export function findSummaryForOpportunity(
  summaries: any[] | undefined | null,
  opportunity: OpportunityLike
): OpportunitySummaryMatch {
  const allSummaries = Array.isArray(summaries) ? summaries : [];
  const opportunityId = String(opportunity.id ?? '').trim();

  if (opportunityId) {
    const linked = allSummaries.find((summary) => summary?.linkedOpportunityId === opportunityId);
    if (linked) {
      return {
        summary: linked,
        matchType: 'linkedOpportunityId',
        reason: 'Matched summary by linked Opportunity ID.',
      };
    }
  }

  const opportunityNumber = readOpportunityValue(opportunity, [
    'opportunityNumber',
    'Opportunity__opportunityNumber',
    'projectNumber',
    'Opportunity__projectNumber',
  ]);
  if (opportunityNumber) {
    const byNumber = allSummaries.find((summary) => String(summary?.opportunityNumber ?? '').trim() === opportunityNumber);
    if (byNumber) {
      return {
        summary: byNumber,
        matchType: 'opportunityNumber',
        reason: 'Matched summary by opportunity number.',
      };
    }
  }

  const opportunityName = readOpportunityValue(opportunity, [
    'opportunityName',
    'Opportunity__opportunityName',
    'name',
    'Opportunity__name',
  ]).toLowerCase();
  if (opportunityName) {
    const nameMatches = allSummaries.filter((summary) => String(summary?.name ?? '').trim().toLowerCase() === opportunityName);
    if (nameMatches.length === 1) {
      return {
        summary: nameMatches[0],
        matchType: 'opportunityName',
        reason: 'Matched summary by opportunity name.',
      };
    }
    if (nameMatches.length > 1) {
      return {
        summary: null,
        matchType: 'none',
        reason: 'Multiple saved summaries share this Opportunity name; link the correct Summary before generating a proposal.',
      };
    }
  }

  return {
    summary: null,
    matchType: 'none',
    reason: 'No saved summary matched this Opportunity.',
  };
}

export async function getSavedSummaries(): Promise<any[]> {
  return (await getSetting<any[]>('summaries', [])) ?? [];
}
