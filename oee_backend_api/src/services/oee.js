const {
  getProductionRunById,
  getDowntimeSecondsForRun,
  getQualityTotalsForRun,
} = require('../db/repositories');

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function secondsBetween(startIso, endIso) {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return Math.floor((e - s) / 1000);
}

/**
 * PUBLIC_INTERFACE
 * Calculates OEE for a given run id using:
 * - Availability = operating_time / planned_production_time
 * - Performance = (ideal_cycle_time * total_count) / operating_time
 * - Quality = good_count / total_count
 *
 * Notes:
 * - If run is still active (ended_at null), calculations use "now" as the end time.
 * @param {string} runId
 * @returns {Promise<object|null>}
 */
async function calculateOeeForRun(runId) {
  const run = await getProductionRunById(runId);
  if (!run) {
    return null;
  }

  const endAt = run.ended_at || new Date().toISOString();
  const elapsedSeconds = secondsBetween(run.started_at, endAt);

  const plannedSeconds = Math.max(0, Number(run.planned_production_seconds || 0));
  const downtimeSeconds = Math.max(0, Number((await getDowntimeSecondsForRun(runId)) || 0));
  const operatingSeconds = Math.max(0, elapsedSeconds - downtimeSeconds);

  const idealCycle = Math.max(0, Number(run.ideal_cycle_time_seconds || 0));
  const quality = await getQualityTotalsForRun(runId);

  const good = Math.max(0, Number(quality.good_total || 0));
  const reject = Math.max(0, Number(quality.reject_total || 0));
  const totalCount = good + reject;

  const availability = plannedSeconds > 0 ? clamp01(operatingSeconds / plannedSeconds) : 0;
  const performance =
    operatingSeconds > 0 && idealCycle > 0 ? clamp01((idealCycle * totalCount) / operatingSeconds) : 0;
  const qualityRate = totalCount > 0 ? clamp01(good / totalCount) : 0;

  const oee = clamp01(availability * performance * qualityRate);

  return {
    run_id: runId,
    oee,
    availability,
    performance,
    quality: qualityRate,
    inputs: {
      started_at: run.started_at,
      ended_at: run.ended_at,
      elapsed_seconds: elapsedSeconds,
      planned_production_seconds: plannedSeconds,
      downtime_seconds: downtimeSeconds,
      operating_seconds: operatingSeconds,
      ideal_cycle_time_seconds: idealCycle,
      good_count: good,
      reject_count: reject,
      total_count: totalCount,
    },
    computed_at: new Date().toISOString(),
  };
}

module.exports = {
  calculateOeeForRun,
};
