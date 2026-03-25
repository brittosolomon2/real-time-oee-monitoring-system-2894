const { calculateOeeForRun } = require('../services/oee');

class OeeController {
  getForRun(req, res) {
    const { runId } = req.params;
    const result = calculateOeeForRun(runId);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Run not found' });
    }
    return res.status(200).json({ data: result });
  }
}

module.exports = new OeeController();
