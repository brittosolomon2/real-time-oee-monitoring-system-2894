#!/bin/bash
cd /home/kavia/workspace/code-generation/real-time-oee-monitoring-system-2894/oee_backend_api
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

