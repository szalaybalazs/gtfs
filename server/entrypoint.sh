#!/bin/sh

# Start the cron daemon in the background
cron

# Then, start the Bun process (adjust if your command differs)
bun src/server.ts