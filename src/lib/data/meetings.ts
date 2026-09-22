import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Meeting } from "@/types/meeting";

export async function listBusinessMeetings(businessId: string | null) {
  return fetchBusinessRecords<Meeting[]>(businessId, "meetings", []);
}

export async function listUpcomingMeetings(businessId: string | null, fromDate: string) {
  const result = await fetchBusinessRecords<Meeting[]>(businessId, "meetings", []);
  return {
    ...result,
    data: result.data.filter((meeting) => meeting.date && meeting.date >= fromDate),
  };
}
