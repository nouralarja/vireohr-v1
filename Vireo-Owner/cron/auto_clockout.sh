#!/bin/bash

#################################################################
# VireoHR Auto Clock-Out Cron Script
#
# This script should run daily at 00:05 AM to automatically
# clock out employees who forgot to clock out and whose shifts
# have ended more than 1 hour ago.
#
# It checks the overtime toggle for each date before proceeding.
# If overtime is enabled for a date, auto clock-out is skipped.
#
# Setup:
# 1. Make executable: chmod +x cron/auto_clockout.sh
# 2. Add to crontab: crontab -e
#    5 0 * * * /path/to/vireohr/cron/auto_clockout.sh >> /var/log/vireohr_clockout.log 2>&1
#
# Or use systemd timer (see README.md)
#################################################################

# Configuration
API_URL="${API_URL:-http://localhost:8001/api}"
LOG_FILE="/var/log/vireohr_clockout.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start
log "========================================="
log "Starting auto clock-out process"
log "API URL: $API_URL"

# Call the auto clock-out endpoint (internal, no auth required)
response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/attendance/auto-clock-out" \
    -H "Content-Type: application/json")

# Extract status code (last line) and body (everything else)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

# Check response
if [ "$http_code" -eq 200 ]; then
    log "✓ Success: $body"
else
    log "✗ Failed with HTTP $http_code: $body"
fi

log "Auto clock-out process completed"
log "========================================="
log ""
