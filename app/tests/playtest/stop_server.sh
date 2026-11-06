#!/bin/bash
# Stops the local server started by start_server.sh.
pkill -f "wrangler pages dev"; pkill -f workerd; sleep 1; echo stopped
