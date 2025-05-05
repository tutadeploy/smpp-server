set -e
BROKER="123.253.110.98:29092"
TOPICS=(
    sms-requests
    sms-responses
    sms-dead-letter
    status-report-dead-letter
)
for topic in "${TOPICS[@]}"; do
    docker compose -f docker-compose.prod.yml exec kafka \
        kafka-topics --create --if-not-exists --topic "$topic" --bootstrap-server $BROKER --partitions 8 --replication-factor 1
done
