# Use an official Bun image as the base
FROM oven/bun:latest

# Install cron (if not already available)
USER root
RUN apt-get update && apt-get install -y cron

# Set working directory
WORKDIR /app

# Copy all project files into the container
COPY . .

# Install dependencies using bun
RUN bun install

# Create a cron file with the schedule:
# This cron job will change directory to /app and run "npm run gtfs:update" every 5 minutes.
RUN echo "*/5 * * * * cd /app && npm run gtfs:update >> /var/log/cron.log 2>&1" \
    > /etc/cron.d/gtfs-update

# Give execution rights on the cron job file and load it into crontab
RUN chmod 0644 /etc/cron.d/gtfs-update && crontab /etc/cron.d/gtfs-update

# Ensure the entrypoint script is executable
RUN chmod +x /entrypoint.sh

# Expose a necessary port if your Bun app listens on one
EXPOSE 3000

# Start the entrypoint script
CMD ["/entrypoint.sh"]
