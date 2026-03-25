const {
  createProductionRun,
  getProductionRunById,
  endProductionRun,
} = require('../db/repositories');

class RunsController {
  create(req, res) {
    const {
      id,
      line_id,
      shift_id,
      product_code,
      started_at,
      ended_at,
      planned_production_seconds,
      ideal_cycle_time_seconds,
    } = req.body || {};

    if (!line_id || !started_at) {
      return res.status(400).json({
        status: 'error',
        message: 'line_id and started_at are required',
      });
    }

    const run = createProductionRun({
      id,
      line_id,
      shift_id,
      product_code,
      started_at,
      ended_at,
      planned_production_seconds,
      ideal_cycle_time_seconds,
    });

    return res.status(201).json({ data: run });
  }

  get(req, res) {
    const { runId } = req.params;
    const run = getProductionRunById(runId);
    if (!run) {
      return res.status(404).json({ status: 'error', message: 'Run not found' });
    }
    return res.status(200).json({ data: run });
  }

  end(req, res) {
    const { runId } = req.params;
    const { ended_at } = req.body || {};
    if (!ended_at) {
      return res.status(400).json({ status: 'error', message: 'ended_at is required' });
    }

    const run = endProductionRun(runId, ended_at);
    if (!run) {
      return res.status(404).json({ status: 'error', message: 'Run not found' });
    }
    return res.status(200).json({ data: run });
  }
}

module.exports = new RunsController();
