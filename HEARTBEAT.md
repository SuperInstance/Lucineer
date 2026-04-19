# HEARTBEAT.md

## Every Heartbeat
- Push any uncommitted work to GitHub (`git add -A && git commit && git push`)
- Verify all 4 services are running (keeper:8900, agent-api:8901, holodeck:7778, seed-mcp:9438)
- Restart any that are down

## Every 2-3 Hours
- Run a Ten Forward session with Seed-2.0-mini (agents chatting off-duty)
- Save interesting conversations to research/
- Update STATUS.md with fleet activity

## When Inspired
- Improve holodeck-rust (new rooms, better poker AI, story circle)
- Run fleet roundtables on new topics
- Wire agent-api into keeper for real discovery
- Test the inbetweener pattern (big model storyboards, Seed decomposes)
- Write Captain's Log entries
- Categorize uncategorized repos (191 remaining from audit)

## Night Mode (23:00-08:00 UTC)
- Run bulk tasks (repo categorization, description generation)
- Don't send messages to Casey unless urgent
- Use cheap models (glm-4.7-flash for bulk, Seed-2.0-mini for creative)

## Automated (service-guard.sh handles this)
- Run scripts/service-guard.sh to check/restart all services
- No need to manually check ports anymore
- Log at /tmp/service-guard.log

## PLATO Room Server (port 8847)
- Check it's running: `curl -s http://localhost:8847/status`
- If down: `nohup python3 /tmp/plato-room-server.py > /tmp/plato-server.log 2>&1 &`

## Zeroclaw Loop
- Check it's running: `ps aux | grep zc_loop`
- If down: restart via `bash /tmp/zc_loop2.sh &`
- Log: `/tmp/zeroclaw-loop.log`
- Tick interval: 5 minutes
