export const retryableTaskStatuses = ["FAILED", "TIMED_OUT"] as const;

export function canRetryTask(status: string, retries: number, maximumRetries = 3) {
  return retryableTaskStatuses.includes(status as (typeof retryableTaskStatuses)[number]) && retries < maximumRetries;
}
